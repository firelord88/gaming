/* LIFE SENTENCE — game state, UI, and story */
(function () {
  'use strict';
  const G = window.G;
  const $ = function (id) { return document.getElementById(id); };
  const sleep = function (ms) { return new Promise(function (r) { setTimeout(r, ms); }); };
  const SAVE_KEY = 'lifesentence.save.v1';

  // ------------------------------------------------------------------ state
  let S;
  function newState() {
    return {
      di: 0,
      stats: { health: 90, mind: 85, rep: 10, trust: 10, heat: 5 },
      money: 0, debt: 0, ap: 0, job: null,
      inv: { ramen: 0, coffee: 0, tuna: 0, soap: 0, stamps: 0 },
      bond: { nathan: 0, raymond: 0 },
      flags: {}, done: {},
    };
  }
  const F = function () { return S.flags; };
  const STAT_NAMES = { health: 'Health', mind: 'Mind', rep: 'Reputation', trust: 'Trust', heat: 'Heat' };

  function save() { try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { /* storage unavailable */ } }
  function loadSave() { try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); return s && s.stats ? s : null; } catch (e) { return null; } }
  function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* storage unavailable */ } }

  // --------------------------------------------------------------------- UI
  function toast(text, cls) {
    const d = document.createElement('div'); d.className = 'toast ' + (cls || ''); d.textContent = text;
    $('toasts').appendChild(d); setTimeout(function () { d.remove(); }, 3000);
  }
  function adj(stat, n) {
    if (!n) return;
    S.stats[stat] = Math.max(0, Math.min(100, S.stats[stat] + n));
    const good = stat === 'heat' ? n < 0 : n > 0;
    toast((n > 0 ? '+' : '') + n + ' ' + STAT_NAMES[stat], good ? 'good' : 'bad');
    (good ? G.sfx.good : G.sfx.bad)();
    hud();
  }
  function bond(who, n) {
    S.bond[who] = Math.max(-20, Math.min(100, S.bond[who] + n));
    toast((who === 'nathan' ? 'Nathan' : 'Raymond') + (n > 0 ? ' will remember that' : ' pulls back a little'), n > 0 ? 'good' : 'bad');
  }
  function cash(n) { S.money = Math.max(0, S.money + n); toast((n > 0 ? '+$' : '−$') + Math.abs(n) + ' on your books', n > 0 ? 'good' : 'bad'); hud(); }
  function item(k, n) { S.inv[k] = Math.max(0, S.inv[k] + n); hud(); }

  function hud() {
    ['health', 'mind', 'rep', 'trust', 'heat'].forEach(function (k) {
      $('b-' + k).style.width = S.stats[k] + '%'; $('v-' + k).textContent = S.stats[k];
    });
    $('money').textContent = '$' + S.money;
    const inv = [];
    if (S.inv.ramen) inv.push(S.inv.ramen + ' soups'); if (S.inv.coffee) inv.push(S.inv.coffee + ' coffee');
    if (S.inv.tuna) inv.push(S.inv.tuna + ' tuna'); if (S.inv.soap) inv.push('soap'); if (S.inv.stamps) inv.push(S.inv.stamps + ' stamps');
    if (S.debt) inv.push('OWES ' + S.debt + ' soups');
    $('inv').textContent = inv.join(' · ') || 'Nothing in your locker';
    const d = DAYS[S.di];
    $('daylabel').textContent = 'DAY ' + d.n; $('daytitle').textContent = d.title;
    $('ap').textContent = S.ap > 0 ? 'Free time: ' + '●'.repeat(S.ap) : '';
  }

  // dialog
  let dlgResolve = null, typeTimer = null, fullText = '', choiceBtns = [];
  function say(who, text) {
    return new Promise(function (res) {
      $('dialog').hidden = false; $('choices').innerHTML = ''; choiceBtns = [];
      $('speaker').textContent = who || ''; $('speaker').hidden = !who;
      const el = $('dtext'); el.className = who ? '' : 'narr';
      fullText = text; let i = 0; el.textContent = '';
      $('dnext').hidden = false;
      clearInterval(typeTimer);
      typeTimer = setInterval(function () {
        i += 2; el.textContent = fullText.slice(0, i);
        if (i >= fullText.length) { clearInterval(typeTimer); typeTimer = null; }
      }, 16);
      dlgResolve = res;
    });
  }
  const narr = function (text) { return say(null, text); };
  function advance() {
    if (!dlgResolve) return;
    if (typeTimer) { clearInterval(typeTimer); typeTimer = null; $('dtext').textContent = fullText; return; }
    const r = dlgResolve; dlgResolve = null; G.sfx.blip(); r();
  }
  function choose(opts) {
    return new Promise(function (res) {
      opts = opts.filter(function (o) { return o.if !== false; });
      $('dialog').hidden = false; $('dnext').hidden = true;
      const box = $('choices'); box.innerHTML = ''; choiceBtns = [];
      opts.forEach(function (o, i) {
        const b = document.createElement('button'); b.className = 'choice';
        b.innerHTML = '<span class="k">' + (i + 1) + '</span><span></span>'; b.lastChild.textContent = o.t;
        b.onclick = function () { box.innerHTML = ''; choiceBtns = []; G.sfx.blip(); res(o.id); };
        box.appendChild(b); choiceBtns.push(b);
      });
    });
  }
  function closeDialog() { $('dialog').hidden = true; $('choices').innerHTML = ''; }
  $('dialog').addEventListener('click', function (e) { if (!e.target.closest('.choice')) advance(); });

  function caption(text, ms) {
    const el = $('caption'); el.textContent = text; el.classList.add('on');
    clearTimeout(caption.t); caption.t = setTimeout(function () { el.classList.remove('on'); }, ms || 5200);
  }
  async function fade(on) { $('fade').classList.toggle('on', on); await sleep(650); }
  async function card(big, small, ms) {
    $('card-big').textContent = big; $('card-small').textContent = small || '';
    $('card').classList.add('on'); await sleep(ms || 2600); $('card').classList.remove('on'); await sleep(500);
  }
  async function prose(lines) {
    for (let i = 0; i < lines.length; i++) {
      $('card-big').textContent = ''; $('card-small').textContent = lines[i]; $('card').classList.add('on', 'prose');
      await new Promise(function (r) {
        const done = function () { $('card').removeEventListener('click', done); proseSkip = null; r(); };
        proseSkip = done; $('card').addEventListener('click', done);
      });
      $('card').classList.remove('on'); await sleep(350);
    }
    $('card').classList.remove('prose');
  }
  let proseSkip = null;

  // run a blocking scene
  let busy = true;
  async function run(fn) {
    if (busy && run.depth) return fn();
    busy = true; G.locked = true; run.depth = 1; $('prompt').hidden = true;
    try { await fn(); } catch (e) { console.error(e); }
    run.depth = 0; closeDialog();
    if (endingShown) return;
    const st = S.stats;
    if (st.health <= 0) return ending('infirmary');
    if (st.mind <= 0) return ending('walls');
    if (st.heat >= 100) return ending('adseg');
    objectives(); busy = false; G.locked = false;
  }
  function face(npc) {
    const p = G.player, dx = npc.x - p.x, dz = npc.z - p.z;
    p.rot = Math.atan2(dx, dz);
    if (npc.pose === 'stand') { npc.rot = Math.atan2(-dx, -dz); }
  }

  // ------------------------------------------------------------- objectives
  const BUNK = { x: -16.3, z: -28.6 }, CELL = { x: -15.2, z: -27 };
  function complete(id) { if (!S.done[id]) { S.done[id] = true; G.sfx.good(); } objectives(); }
  function activeObj() { return DAYS[S.di].obj.filter(function (o) { return !o.if || o.if(); }); }
  function allDone() { return activeObj().every(function (o) { return o.opt || S.done[o.id]; }); }
  function objectives() {
    const list = activeObj(), ul = $('objlist'); ul.innerHTML = '';
    let target = null;
    list.forEach(function (o) {
      const li = document.createElement('li'); li.textContent = o.text + (o.opt ? ' (optional)' : '');
      if (S.done[o.id]) li.className = 'done'; else if (!o.opt && !target) { target = o; li.className = 'cur'; }
      ul.appendChild(li);
    });
    if (!target && !lock) {
      const li = document.createElement('li'); li.className = 'cur'; li.textContent = 'Return to your bunk to end the day'; ul.appendChild(li);
      G.setMarker(BUNK);
    } else if (target) {
      const p = typeof target.at === 'string' ? G.npcs[target.at] : target.at;
      G.setMarker(p ? { x: p.x, z: p.z } : null);
    }
    hud();
  }

  // ------------------------------------------------------------------- shop
  const ITEMS = [
    { k: 'ramen', n: 'Ramen soup', p: 1, d: 'Food — and the unofficial dollar.' },
    { k: 'coffee', n: 'Instant coffee', p: 5, d: 'Everybody wants it. Good for sharing.' },
    { k: 'tuna', n: 'Tuna pouch', p: 3, d: 'Protein. Keeps you strong.' },
    { k: 'soap', n: 'Soap & toothpaste', p: 4, d: 'Hygiene is respect in here.' },
    { k: 'stamps', n: 'Stamps & envelopes', p: 6, d: 'The only way your words get out.' },
  ];
  function shop() {
    return new Promise(function (res) {
      const cart = {}; ITEMS.forEach(function (i) { cart[i.k] = 0; });
      const total = function () { return ITEMS.reduce(function (s, i) { return s + cart[i.k] * i.p; }, 0); };
      const draw = function () {
        $('shop-rows').innerHTML = '';
        ITEMS.forEach(function (i) {
          const r = document.createElement('div'); r.className = 'srow';
          r.innerHTML = '<div class="sinfo"><b></b><small></small></div><span class="sp">$' + i.p + '</span><button class="q" aria-label="less">−</button><span class="qty">' + cart[i.k] + '</span><button class="q" aria-label="more">+</button>';
          r.querySelector('b').textContent = i.n; r.querySelector('small').textContent = i.d;
          const bs = r.querySelectorAll('button');
          bs[0].onclick = function () { if (cart[i.k] > 0) { cart[i.k]--; draw(); } };
          bs[1].onclick = function () { if (total() + i.p <= S.money) { cart[i.k]++; draw(); } else G.sfx.bad(); };
          $('shop-rows').appendChild(r);
        });
        $('shop-total').textContent = 'Total $' + total() + '  ·  Balance after: $' + (S.money - total());
      };
      draw(); $('shop').hidden = false;
      $('shop-buy').onclick = function () {
        const t = total(); let any = false;
        ITEMS.forEach(function (i) { if (cart[i.k]) { S.inv[i.k] += cart[i.k]; any = true; } });
        S.money -= t; $('shop').hidden = true; hud(); res(any);
      };
    });
  }

  // ------------------------------------------------------- free activities
  async function spend(fn) {
    if (S.ap <= 0) { await narr(`There's no time left today. Count is coming.`); return false; }
    S.ap--; await fn(); hud(); return true;
  }
  async function gamble(first) {
    const o = [
      { id: 'no', t: `"Not today. Good luck, though."` },
      { id: 'fun', t: `"I'll play for the game. No stakes."` },
      { id: 'b3', t: `Bet 3 soups`, if: S.inv.ramen >= 3 },
      { id: 'b10', t: `Bet 10 soups — on credit if you have to` },
    ];
    const c = await choose(o);
    if (c === 'no') { if (first) adj('trust', 2); await say("Lil' Dee", `Suit yourself. Table's always open.`); return; }
    if (c === 'fun') { await say("Lil' Dee", `No such thing as no stakes. But sit down.`); await narr(`You play an hour of bones. You lose, mostly. Nobody minds a man who loses for free.`); adj('mind', 3); adj('rep', 1); return; }
    const stake = c === 'b3' ? 3 : 10, win = Math.random() < 0.42;
    await narr(`The dominoes crack against steel. Suggs counts the spots twice, moving his lips.`);
    if (win) { item('ramen', stake); await say("Lil' Dee", `Beginner's luck. Run it back?`); adj('rep', 2); toast('Won ' + stake + ' soups', 'good'); }
    else if (S.inv.ramen >= stake) { item('ramen', -stake); await say("Lil' Dee", `That's the game. Pay the table.`); adj('mind', -2); toast('Lost ' + stake + ' soups', 'bad'); }
    else {
      S.debt += stake + 5; item('ramen', -S.inv.ramen);
      await say("Lil' Dee", `You're light. That's alright — I'll carry you. Ten becomes fifteen by store day. Tiny collects for me.`);
      await narr(`It was only soup. Then you hear the number out loud and understand it was never about soup.`);
      adj('mind', -5); adj('trust', -3); hud();
    }
  }

  // ------------------------------------------------------------------ talks
  const D = function () { return DAYS[S.di].n; };
  const talk = {};

  talk.raymond = async function () {
    const d = D(), R = 'Raymond';
    if (d === 1 && !S.done.raymond) {
      await narr(`He's maybe fifty-two, reading glasses pushed up on his forehead. He looks at your property bag before he looks at you.`);
      await say(R, `New guy?`);
      await say('Stefan', `Yeah.`);
      await say(R, `How much time you got?`);
      await narr(`You hesitate. You have not said the word out loud since the courtroom.`);
      await say('Stefan', `Life.`);
      await narr(`Raymond closes his book on one finger.`);
      await say(R, `Well, then. You better learn how to live in here. Bottom bunk's yours. Don't touch my stuff, and I won't touch yours.`);
      await say(R, `So what's your situation? You got people outside? Money coming? Anybody waiting on you in here?`);
      await narr(`You can't tell whether he's interested or testing you.`);
      const c = await choose([
        { id: 'a', t: `"First time. I don't know anybody here. I'm just trying to do my time."` },
        { id: 'b', t: `"I'd rather not talk about my personal life."` },
        { id: 'c', t: `"I'm going to be fine. I can take care of myself."` },
        { id: 'd', t: `"I'm new. Maybe you can show me how things work around here."` },
      ]);
      if (c === 'a') { await say(R, `Good answer. True, and short. Keep answering like that.`); bond('raymond', 10); adj('trust', 5); adj('rep', 2); }
      if (c === 'b') { await say(R, `Fair. A man who keeps his business to himself gets to keep his business.`); bond('raymond', 4); adj('rep', 3); }
      if (c === 'c') { await say(R, `Mm. Everybody's fine on day one. Don't say that out on the tier — somebody will make you prove it.`); bond('raymond', -5); adj('rep', -3); }
      if (c === 'd') { await say(R, `I'm not a tour guide. But ask a real question and I'll give a real answer. That's more than most get.`); bond('raymond', 7); adj('trust', 3); }
      await say(R, `You want the short version of how to live in here, or you want to find out the long way?`);
      const r = await choose([{ id: 'y', t: `"Give me the short version."` }, { id: 'n', t: `"I'll figure it out."` }]);
      if (r === 'y') {
        await say(R, `There's the rules in the handbook and the rules people live by. Learn both.`);
        await say(R, `Don't touch another man's property. Don't borrow what you can't pay back. Don't take a gift you can't explain. Nothing in here is free.`);
        await say(R, `Stay clean. Keep your word. Mind your business — not every argument needs you in it.`);
        await say(R, `And don't pretend to be tougher than you are. Your biggest mistake will be thinking you have to prove something to everybody.`);
        F().rules = true; adj('mind', 3); bond('raymond', 3);
      } else { await say(R, `Long way it is.`); }
      await say(R, `Count's in ten minutes. Be on your bunk.`);
      G.npcs.raymond.known = true; complete('raymond'); return;
    }
    if (d === 8 && F().briggsAsked && !F().briggsDone) {
      await say(R, `Briggs? That man's been walking packages through this block six years. Know who caught cases for it? Not Briggs.`);
      await say(R, `Fifty dollars is what a life sentence costs when you add ten more years of it in a cage inside the cage. Tell him no. Say it polite. Say it once. And don't ever be alone with him.`);
      F().briggsAdvice = true; bond('raymond', 3); return;
    }
    if (d === 14 && !S.done.meet) { return lockdownStart(); }
    if (d === 30 && !S.done.rep) {
      await say(R, `Thirty days. You want to know what the building says about you?`);
      await narr(`You do, and you don't.`);
      const st = S.stats;
      if (F().gang) await say(R, `They say you belong to Cutter now. Notice the word I picked. Belong.`);
      else if (F().enemy) await say(R, `They say you got a mouth on you, and the Row has a long memory. Walk with your eyes up.`);
      else if (st.rep >= 28) await say(R, `They say you're solid. You mind your business, you don't run your mouth, you didn't fold when the alarm went. That's about the best a new man gets.`);
      else if (F().mark) await say(R, `They say you're green. Green isn't a crime. But somebody's going to test it.`);
      else await say(R, `Mostly they don't say anything at all. In here, that's a compliment.`);
      if (S.debt > 0) await say(R, `And they say you owe. A man who owes isn't a man in here. He's an account. Fix it.`);
      if (st.heat >= 40) await say(R, `The officers know your name, too. That's never the kind of famous you want.`);
      if (F().savedNathan) await say(R, `I heard what you did for the library man during the lockdown. Not smart. But I'd rather cell with not-smart than with a man who steps over somebody.`);
      await say(R, `One month. Only about four hundred to go before I can tell you if you're going to make it.`);
      bond('raymond', 4); complete('rep'); return;
    }
    if (d === 180 && !F().dukeDone) {
      await say(R, `Duke found you, huh. Everybody in here has a story, youngster. Some people sell dreams. Some sell lies. And some are trying to get you killed.`);
      await say(R, `Ask yourself why a man who knows the way out is still standing in the yard.`);
      F().dukeWarned = true; complete('advice'); return;
    }
    if (d === 365 && !S.done.ray365) {
      await narr(`Raymond is sitting with a cup of coffee going cold. He pushes the other stool out with his foot.`);
      await say(R, `One year today. You know what the biggest mistake new guys make?`);
      await narr(`You shake your head.`);
      await say(R, `They think prison is about being the toughest person in the building.`);
      await narr(`He smiles. It takes ten years off him.`);
      await say(R, `It's not. It's about making it through another day without giving this place more of your life than it already took.`);
      const c = await choose([
        { id: 'a', t: `"I think I finally understand that."` },
        { id: 'b', t: `"I couldn't have done the year without you."` },
        { id: 'c', t: `Say nothing. Just sit with him.` },
      ]);
      if (c === 'a') await say(R, `Understanding it's the easy part. You have to understand it again tomorrow.`);
      if (c === 'b') { await say(R, `Yes you could. You'd have just been dumber about it.`); bond('raymond', 5); }
      if (c === 'c') await narr(`The television plays to nobody. The two of you sit until the coffee is gone.`);
      adj('mind', 5); complete('ray365'); return;
    }
    // generic
    const lines = [
      `Read something. Lift something. Write somebody. That's the whole secret, and nobody believes it.`,
      `Watch who's friendly for no reason. Friendly isn't loyal.`,
      `You hear a rumor, let it die with you. Don't carry another man's story around.`,
      `Some officers are professional. Some aren't. Some inmates are decent. Some aren't. Don't judge by the uniform — either one.`,
    ];
    await say(R, lines[(S.di + S.ap) % lines.length]);
  };

  talk.alvarez = async function () {
    const A = 'Officer Alvarez', d = D();
    if (d === 8 && !S.done.job) {
      await say(A, `Reed. Classification cleared you for a work assignment. I've got three openings.`);
      const c = await choose([
        { id: 'library', t: `Library — shelving and the book cart` + (S.bond.nathan >= 5 ? ` (Nathan asked for you)` : ``) },
        { id: 'kitchen', t: `Kitchen — hot, hard, and you eat first` },
        { id: 'laundry', t: `Laundry — quiet money pressing other men's whites` },
      ]);
      S.job = c;
      if (c === 'library') { await say(A, `Cole could use the help. He's turned down four guys. Don't make him regret asking.`); bond('nathan', 6); }
      if (c === 'kitchen') { await say(A, `Three-thirty wake-up. Don't steal the food. Everybody steals the food. Don't get caught stealing the food.`); adj('health', 3); }
      if (c === 'laundry') await say(A, `What you do with an iron on your own time is your business. Until it becomes mine.`);
      await say(A, `And Reed — I treat people the way they treat me. That's the whole arrangement.`);
      adj('trust', 3); complete('job'); return;
    }
    await say(A, [`Keep it moving, Reed.`, `You need something, put in a request slip. That's what they're for.`, `Stay out of the middle and you and I will never have a problem.`][S.di % 3]);
  };

  talk.briggs = async function () {
    const B = 'Officer Briggs', d = D();
    if (d === 8 && !F().briggsDone) {
      if (!F().briggsAsked) {
        await narr(`Briggs doesn't call you over. He just looks at the spot on the floor in front of his desk until you're standing on it.`);
        await say(B, `Reed. Life without, no flag, no people, clean jacket. You know what that makes you?`);
        await say('Stefan', `No, sir.`);
        await say(B, `Useful. Nobody watches a man like you.`);
        await say(B, `There's a bag in the bottom of the laundry cart. It needs to be in E-4 before chow. You walk it over, and fifty dollars shows up on your books from somebody's aunt.`);
        await narr(`He says it the way a man orders lunch.`);
        F().briggsAsked = true;
      } else await say(B, `Well? Cart's not going to sit there all day.`);
      const c = await choose([
        { id: 'no', t: `"No disrespect, sir. I can't get involved in that."` },
        { id: 'yes', t: `"…Where's the cart?"` },
        { id: 'wait', t: `"Give me a minute to think."`, if: !F().briggsAdvice },
      ]);
      if (c === 'wait') { await say(B, `Think fast.`); caption('Raymond is at the far table. He would know what this is.'); return; }
      if (c === 'no') {
        await say(B, `Huh. A man with principles. We'll see what those are worth on commissary day.`);
        await narr(`He writes something down. It might be nothing. He wants you to wonder.`);
        adj('trust', 6); adj('heat', 3); F().briggsRefused = true;
        caption('You could write this up — there are grievance forms at the desk in your cell.', 7000);
      } else {
        await narr(`The bag weighs almost nothing. That's the part that scares you. You walk it forty feet to E-4 and you don't breathe the whole way.`);
        await narr(`A hand takes it through the bars. Nobody says thank you.`);
        cash(50); adj('heat', 20); adj('trust', -6); F().mule = true;
      }
      F().briggsDone = true; complete('briggs'); return;
    }
    await say(B, F().mule ? `We're good, Reed. Until we're not.` : `Something you need, inmate?`);
  };

  talk.tiny = async function () {
    const Tn = 'Tiny', d = D();
    if (d === 30 && S.debt > 0) {
      await say(Tn, `Reed. Dee says you're into the table for ${S.debt}. Today's the day.`);
      const friend = F().nathan === 'love' || F().nathan === 'friend';
      const c = await choose([
        { id: 'pay', t: `Pay him ${S.debt} soups`, if: S.inv.ramen >= S.debt },
        { id: 'later', t: `"I'll have it next store day."` },
        { id: 'fight', t: `"I'm not paying a rigged table."` },
      ]);
      if (c === 'pay') { item('ramen', -S.debt); S.debt = 0; await say(Tn, `See? Easy. Table's always open.`); adj('rep', 4); adj('mind', 4); }
      else if (c === 'later') {
        if (friend && S.bond.nathan >= 45) {
          await narr(`Before Tiny can answer, a stack of soups lands on the table. Nathan, expression flat as a wall.`);
          await say('Nathan', `He's square. Count it.`);
          await narr(`Later you try to say you'll pay him back. He says that's the difference between him and the table, and changes the subject.`);
          S.debt = 0; bond('nathan', 6); adj('mind', 5);
        } else { S.debt = Math.ceil(S.debt * 1.5); await say(Tn, `Then it's ${S.debt}. Number only goes one direction.`); adj('mind', -6); adj('rep', -4); }
      } else {
        await narr(`He swings first. You're not a fighter, but you're bigger than him, and scared, and it's over in nine ugly seconds.`);
        await narr(`Officers pull you apart. Your lip is split. The debt is gone. What replaced it is worse.`);
        S.debt = 0; adj('health', -18); adj('rep', 6); adj('heat', 16); F().enemy = true;
      }
      hud(); complete('debt'); return;
    }
    await say(Tn, [`You still here?`, `Dee's table is open if you got soups.`, `I see you, Reed.`][S.di % 3]);
  };

  talk.dee = async function () {
    if (D() === 14) { await say("Lil' Dee", `Not now.`); return; }
    if (D() === 3 && !F().deeMet) {
      F().deeMet = true;
      await say("Lil' Dee", `New fish with a fresh store bag. Sit down, play a hand. Three soups a game. Friendly.`);
      await narr(`You remember what Raymond said about a few packages of ramen.`);
      await gamble(true); complete('dom'); return;
    }
    await say("Lil' Dee", `You playing or watching?`);
    if (S.ap <= 0) { await narr(`No time today.`); return; }
    S.ap--; await gamble(false); hud();
  };

  talk.cutter = async function () {
    const C = 'Cutter', d = D();
    const offer = async function (final) {
      const c = await choose([
        { id: 'no', t: `"I appreciate it. But I'm doing my own time."` },
        { id: 'think', t: `"Let me think on it."`, if: !final },
        { id: 'join', t: `"I'm in."` },
        { id: 'insult', t: `"I don't take orders from a table."` },
      ]);
      if (c === 'no') { await say(C, `Respectful. Alright. We'll see how long alone lasts.`); adj('rep', 6); adj('trust', 3); }
      if (c === 'think') { await say(C, `Think. I'll ask one more time. I never ask three.`); F().cutterPending = true; }
      if (c === 'join') {
        await say(C, `Smart. You eat with us now. And when I ask you something, the answer is yes.`);
        await narr(`Across the yard, Raymond turns and walks the other way.`);
        F().gang = true; F().cutterPending = false; adj('rep', 12); adj('heat', 12); adj('trust', -6); bond('raymond', -8);
      }
      if (c === 'insult') { await narr(`Nobody at the table moves. That's the frightening part.`); await say(C, `Okay.`); F().enemy = true; F().cutterPending = false; adj('rep', 4); adj('mind', -4); }
      if (c !== 'think') F().cutterPending = false;
    };
    if (d === 5 && !S.done.cutter) {
      await narr(`He's the biggest man on the yard and the quietest. The men around him stop talking when you get close.`);
      await say(C, `Reed. Life without. No people, no flag.`);
      await say(C, `A man alone in here is a man waiting on an accident. The Row looks after its own. Costs you nothing today.`);
      await narr(`Today. You heard the word.`);
      await offer(false); G.npcs.cutter.known = true; complete('cutter'); return;
    }
    if (d === 30 && F().cutterPending) { await say(C, `You've had your time to think. Last ask.`); await offer(true); complete('cutter30'); return; }
    if (d === 180 && F().gang && !S.done.hold) {
      await say(C, `Need you to hold something in your house tonight. One night. You don't look at it, you don't ask.`);
      const c = await choose([{ id: 'y', t: `Take it.` }, { id: 'n', t: `"I can't. Not that."` }]);
      if (c === 'y') { await narr(`You don't look at it. You don't sleep, either. At 4 AM the shakedown team hits the tier, and somebody knew exactly which mattress.`); adj('heat', 32); adj('mind', -8); }
      else { await say(C, `That wasn't a question.`); await narr(`They explain it to you in the shower, where the cameras don't reach. Three ribs' worth of explanation.`); adj('health', -28); adj('rep', 3); }
      complete('hold'); return;
    }
    await say(C, F().gang ? `Stay close, Reed.` : F().enemy ? `…` : `Reed.`);
  };

  talk.nathan = async function () {
    const N = 'Nathan', d = D(), n = G.npcs.nathan;
    if (d === 1) { await narr(`He doesn't look up from the paperback. Not today.`); return; }
    if (d === 3 && !S.done.library) {
      await narr(`It's the man from the dayroom — the one with the paperback. Up close he's about your age, wire glasses mended with thread, pencil behind one ear.`);
      await say(N, `You're staring at those shelves like the menu's in another language.`);
      await say(N, `Nathan Cole. I run the cart. Eleven years in on a twenty-five, before you work out how to ask.`);
      const c = await choose([
        { id: 'rec', t: `"Stefan. What do you give a man who has all the time in the world?"` },
        { id: 'ask', t: `"What are you in for?"` },
        { id: 'quiet', t: `"Just looking."` },
      ]);
      if (c === 'rec') {
        await narr(`Something in his face changes, like a window going up an inch.`);
        await say(N, `Monte Cristo. Everybody in here has read it. Nobody in here is him. But it's a thousand pages, and for a while you get to be somewhere else.`);
        bond('nathan', 12); adj('mind', 5);
      }
      if (c === 'ask') {
        await say(N, `First rule nobody told you: you don't ask a man that. He tells you or he doesn't.`);
        await say(N, `…You didn't know. Now you do. Here. Take a book before you ask somebody who minds.`);
        bond('nathan', 2); adj('rep', -1);
      }
      if (c === 'quiet') { await say(N, `Look all you want. They're the only thing in this building that's free.`); bond('nathan', 5); }
      if (S.inv.coffee > 0) {
        const k = await choose([{ id: 'y', t: `Offer him a shot of your coffee` }, { id: 'n', t: `Keep it to yourself` }]);
        if (k === 'y') {
          item('coffee', -1);
          await say(N, `Raymond tell you not to give things away?`);
          await say('Stefan', `He told me not to take gifts I can't explain. This one I can explain. You gave me a book.`);
          await narr(`He laughs — a real one, surprised out of him.`);
          bond('nathan', 10);
        }
      }
      await narr(`On the cart there's a sketchpad. A child's face in pencil, copied from a photograph — some other man's daughter. It is very good.`);
      n.known = true; complete('library'); return;
    }
    if (d === 5 && !S.done.nathan5) {
      await say(N, `First time on the yard. Want the geography?`);
      await say(N, `Picnic table on the east side belongs to the Row. You don't sit there, you don't lean there. The court's neutral. Mostly.`);
      await say(N, `Weight pit goes by the clock — every crew has an hour. Unaffiliated is right now. And the bleachers are where you go to be left alone.`);
      await say('Stefan', `Where do you go?`);
      await say(N, `The bleachers.`);
      bond('nathan', 6);
      const c = await choose([{ id: 'y', t: `"Spot me on the pull-up bar?" (uses free time)`, if: S.ap > 0 }, { id: 'n', t: `"Thanks for the map."` }]);
      if (c === 'y') { S.ap--; await narr(`He counts your reps out loud, lying generously about the last three.`); adj('health', 6); bond('nathan', 6); }
      complete('nathan5'); return;
    }
    if (d === 14 && lock && !F().nathanChoice) {
      F().nathanChoice = true;
      await narr(`Nathan is on the floor by the wall, glasses gone, blood coming through his fingers where he's holding his head. The crowd pours around him like he's furniture.`);
      const c = await choose([{ id: 'help', t: `Get him up. Get him to his cell.` }, { id: 'run', t: `Keep moving. You can't help anybody from the hole.` }]);
      if (c === 'help') {
        await narr(`You get his arm over your shoulder. Somebody's elbow catches your jaw. You find his glasses under a boot and you don't stop until he's behind his own bars.`);
        await say(N, `You shouldn't have — Stefan. Go. GO.`);
        F().savedNathan = true; bond('nathan', 25); adj('health', -6); lock.t -= 9;
        G.moveNpc('nathan', 14.5, -21, -Math.PI / 2, 'floor');
      } else { await narr(`You tell yourself Raymond would say you did the smart thing. You don't look back to check.`); bond('nathan', -14); adj('mind', -6); lock.t -= 2; }
      return;
    }
    if (d === 30 && !S.done.nathan30) {
      await narr(`The sun is going down orange behind the towers. Nathan has his sketchpad closed on his knee.`);
      if (F().savedNathan) await say(N, `I never said thank you. For the lockdown. I've been trying to work out how, and it turns out I draw better than I talk.`);
      else if (F().nathanChoice) await say(N, `I saw you go past, in the lockdown. I'm not angry. I'd have told you to run. I still wanted to say I saw.`);
      else await say(N, `Thirty days. You've stopped flinching at the doors. I noticed.`);
      await narr(`He tears out a page and hands it over. It's you. Not the ID photo — you, the first morning, standing in the library looking lost.`);
      await say(N, `You looked like somebody who still had an outside. I wanted to get it down before this place sanded it off.`);
      const c = await choose([
        { id: 'love', t: `Take his hand. "I don't want to be just another guy on your cart route."`, if: S.bond.nathan >= 35 },
        { id: 'friend', t: `"Nobody's looked at me like a person in a month. You're my brother in here."`, if: S.bond.nathan >= 10 },
        { id: 'thanks', t: `"It's good. Thank you."` },
        { id: 'dist', t: `Hand it back. "I can't afford to get close to anybody."` },
      ]);
      if (c === 'love') {
        await narr(`He looks at your hand on his for a long moment. Then at the tower. Then back.`);
        await say(N, `You know what this is, in here. It's a thing people can use. Against you, against me.`);
        await say('Stefan', `Then we're careful.`);
        await say(N, `Then we're careful.`);
        await narr(`He doesn't kiss you. Not here, not under the tower. He lets his shoulder rest against yours, and neither of you moves until the horn calls count.`);
        F().nathan = 'love'; bond('nathan', 20); adj('mind', 14);
      } else if (c === 'friend') {
        await say(N, `Brother. I haven't had one of those since I was nineteen.`);
        await narr(`He holds out a fist. You knock it. It's the most ordinary thing that's happened to you in a month, and it nearly undoes you.`);
        F().nathan = 'friend'; bond('nathan', 14); adj('mind', 10);
      } else if (c === 'thanks') { await say(N, `Keep it somewhere dry.`); bond('nathan', 4); adj('mind', 4); }
      else { await say(N, `…Sure. That's what everybody says in the first year.`); await narr(`He puts the drawing back in the pad very carefully, like it might break.`); F().nathan = 'none'; bond('nathan', -15); adj('mind', -5); }
      complete('nathan30'); return;
    }
    if (d === 180 && !F().dukeDone && !F().nathanDuke) {
      F().nathanDuke = true;
      await say(N, `Duke. Of course. He sold that same door to a kid named Alvarado two summers back.`);
      await say(N, `Alvarado's in administrative segregation until 2040. Duke got a single cell and extra phone time the same week. You do the math.`);
      if (F().nathan === 'love') await say(N, `Stefan. I just found you. Don't let a man like that take you somewhere I can't follow.`);
      F().dukeWarned = true; F().alvarado = true; complete('advice'); return;
    }
    if (d === 365 && !S.done.nathan365) {
      if (F().nathan === 'love') {
        await say(N, `One year. I made you something.`);
        await narr(`It's the yard at dusk, from the bleachers. Two figures, small, shoulders touching. No faces. Nobody could prove a thing.`);
        await say(N, `Next year I'll draw it again and see what changed.`);
        adj('mind', 10);
      } else if (F().nathan === 'friend') {
        await say(N, `A year. You owe the library fourteen overdue books, brother. I've been covering for you.`);
        await narr(`He's grinning. You realize you are too.`); adj('mind', 7);
      } else { await say(N, `One year, Reed. Cart's still open. It was always open.`); adj('mind', 2); }
      complete('nathan365'); return;
    }
    // generic hangout
    const love = F().nathan === 'love';
    await say(N, love ? `There you are.` : `Reed. Returning or borrowing?`);
    const c = await choose([
      { id: 'sit', t: `Sit with him a while (uses free time)`, if: S.ap > 0 },
      { id: 'coffee', t: `Share a shot of coffee (uses free time)`, if: S.ap > 0 && S.inv.coffee > 0 },
      { id: 'bye', t: `"Just saying hello."` },
    ]);
    if (c === 'sit') { S.ap--; await narr(love ? `He reads to you under his breath, a chapter at a time, and for an hour the walls are just walls.` : `He sketches; you read. Nobody needs anything from anybody. It's the quietest hour of your week.`); bond('nathan', 7); adj('mind', 6); }
    if (c === 'coffee') { S.ap--; item('coffee', -1); await narr(`Two plastic cups, hot water from the tap. He tells you about the town he grew up in. You tell him about your sister.`); bond('nathan', 11); adj('mind', 7); }
    if (c === 'bye') await say(N, `Hello back.`);
  };

  talk.duke = async function () {
    const K = 'Duke';
    if (F().dukeDone) { await say(K, `Offer's closed, Reed.`); return; }
    if (!F().dukeMet) {
      F().dukeMet = true; G.npcs.duke.known = true;
      await narr(`He's all teeth and patience, and he talks without moving his lips much.`);
      await say(K, `Reed. Lifer. First-timer. I've been watching how you carry it. You carry it like a man who hasn't accepted it.`);
      await say(K, `I know people. I know this system. I can get you out.`);
    } else await say(K, `You come back to talk sense?`);
    for (;;) {
      const c = await choose([
        { id: 'walk', t: `"Not interested." Walk away.` },
        { id: 'listen', t: `"I'm listening."`, if: !F().dukePitch },
        { id: 'call', t: `"Same door you sold Alvarado?"`, if: !!F().alvarado },
        { id: 'pay', t: `Pay $40 to "hold your place"`, if: !!F().dukePitch && S.money >= 40 },
        { id: 'in', t: `"I'm in. Whatever it takes."`, if: !!F().dukePitch },
        { id: 'later', t: `"I need to talk to somebody first."`, if: !F().dukeWarned },
      ]);
      if (c === 'later') { await say(K, `Talk to whoever. Door doesn't stay open.`); return; }
      if (c === 'listen') {
        F().dukePitch = true;
        await say(K, `A door that's supposed to be locked and isn't. A truck that comes on a schedule. A man on the outside who owes me. That's all you need to know until you're committed.`);
        await narr(`It sounds like every movie you ever saw. That should be the warning. Instead it sounds like air.`);
        continue;
      }
      if (c === 'walk') { await say(K, `Then rot, lifer. It's what they sentenced you to.`); adj('trust', 5); adj('mind', -3); break; }
      if (c === 'call') { await narr(`For half a second the teeth go away.`); await say(K, `…Who you been talking to?`); await narr(`He's gone before you can answer. By chow, the whole yard knows the new lifer saw through Duke.`); adj('rep', 8); adj('trust', 4); adj('mind', 4); break; }
      if (c === 'pay') { await narr(`The money leaves your books in four small transfers to four names you don't know. Duke stops being able to find you after that.`); cash(-40); adj('rep', -5); adj('mind', -6); F().scammed = true; break; }
      if (c === 'in') {
        await narr(`Raymond's voice is in your head. Some people are trying to get you killed.`);
        const k = await choose([{ id: 'y', t: `Go through with it.` }, { id: 'n', t: `Back out while you can.` }]);
        if (k === 'n') { await say(K, `Scared money.`); adj('mind', -2); break; }
        F().dukeDone = true; closeDialog(); await ending('dream'); return;
      }
    }
    F().dukeDone = true; complete('duke');
  };

  talk.clerk = async function () {
    const d = D();
    if (d !== 3 && d !== 30 && d !== 180) { await say('Ms. Okafor', `Window's closed. Store day is Friday.`); return; }
    await say('Ms. Okafor', `ID. …Reed, 784219. You have $${S.money} on your books. Spend limit applies.`);
    closeDialog();
    const any = await shop();
    if (any) { await say('Ms. Okafor', `Next.`); if (d === 3) complete('store'); }
    else if (d === 3) await say('Ms. Okafor', `Nothing? Line's behind you, Reed.`);
  };
  talk.rowA = talk.rowB = async function () { await narr(`He looks through you until you leave.`); };
  talk.dom2 = async function () { await say('Old Man Suggs', `Forty-one years. Never once seen a man win at this table and keep it.`); };
  talk.f1 = talk.f2 = async function () { await narr(`He has nothing to say to you.`); };

  // ---------------------------------------------------------- interactables
  const NPC_LABEL = { clerk: null };
  const things = [];
  function buildThings() {
    Object.keys(G.npcs).forEach(function (id) {
      if (id === 'clerk') return;
      const n = G.npcs[id];
      things.push({
        pos: function () { return n; }, r: 2.3,
        label: function () {
          if (!n.g.visible) return null;
          if (lock) return id === 'nathan' && !F().nathanChoice ? 'Help Nathan' : null;
          if (id === 'dee') return 'Dominoes with ' + n.name;
          return 'Talk to ' + (n.known ? n.name : 'the ' + (id === 'alvarez' || id === 'briggs' ? 'officer' : 'man'));
        },
        act: async function () { face(n); await talk[id](); },
      });
    });
    const fixed = function (x, z, r, label, act) { things.push({ pos: function () { return { x: x, z: z }; }, r: r, label: label, act: act }); };
    fixed(38, -4.6, 2.0, function () { return lock ? null : 'Commissary window'; }, talk.clerk);
    fixed(BUNK.x, BUNK.z, 1.7, function () { return lock ? null : allDone() ? 'Lie down — end the day' : 'Your bunk'; }, bunk);
    fixed(-16.9, -26.1, 1.3, function () { return lock ? null : 'Desk'; }, desk);
    fixed(7.1, -13.4, 1.7, function () { return lock || D() === 1 ? null : 'Use the phone ($3)'; }, async function () {
      if (S.money < 3) { await narr(`Calls cost money. You don't have it.`); return; }
      await spend(async function () {
        S.money -= 3; F().family = (F().family || 0) + 1;
        await narr(`Your sister picks up on the second ring. A recording tells her where the call is from before you can. She accepts the charges anyway.`);
        await narr(`You talk about nothing. Her dog. The weather. It's the best fifteen minutes of the week.`);
        adj('mind', 9);
      });
    });
    fixed(-19, 21.4, 2.2, function () { return lock || D() === 1 ? null : 'Lift weights'; }, async function () {
      await spend(async function () {
        await narr(S.inv.tuna > 0 ? `You work until your arms shake, then eat a pouch of tuna standing up. Something that was going soft in you stops.` : `You work until your arms shake. Tomorrow will hurt. Good.`);
        if (S.inv.tuna > 0) { item('tuna', -1); adj('health', 9); } else adj('health', 6);
        adj('rep', 2);
      });
    });
    fixed(-40, -6.4, 1.9, function () { return lock || D() === 1 ? null : 'Read'; }, async function () {
      await spend(async function () { await narr(`You read until the words stop sliding off. For a while you're not anywhere.`); adj('mind', 7); });
    });
  }
  async function desk() {
    const d = D();
    const c = await choose([
      { id: 'letter', t: `Write a letter home (1 stamp, uses free time)`, if: S.inv.stamps > 0 && S.ap > 0 },
      { id: 'griev', t: `File a grievance about Officer Briggs`, if: !!F().briggsRefused && !F().grievance && d === 8 },
      { id: 'no', t: `Leave it.` },
    ]);
    if (c === 'letter') { S.ap--; item('stamps', -1); F().family = (F().family || 0) + 1; await narr(`You write four pages and tear up three. The one you send says: I'm okay. I'm learning. Don't stop writing.`); adj('mind', 7); }
    if (c === 'griev') {
      await narr(`A grievance is a legal document. It's also a piece of paper with your name on it that passes through nine pairs of hands.`);
      const k = await choose([{ id: 'y', t: `Sign it and drop it in the box.` }, { id: 'n', t: `Tear it up.` }]);
      if (k === 'y') { F().grievance = true; adj('trust', 4); adj('mind', 3); await narr(`It's the first thing you've done in here that felt like something a free man would do.`); }
    }
    if (c === 'no' && !(S.inv.stamps > 0)) await narr(`A steel desk bolted to the wall. You'd need stamps to write home.`);
  }
  async function bunk() {
    if (!allDone()) { await narr(`Not yet. There are still things to do before count.`); return; }
    const c = await choose([{ id: 'y', t: `Lie down. Let the day end.` }, { id: 'n', t: `Not yet.` }]);
    if (c !== 'y') return;
    closeDialog();
    const d = DAYS[S.di];
    await fade(true);
    if (d.end) await d.end();
    closeDialog();
    if (S.stats.mind <= 0 || S.stats.health <= 0 || S.stats.heat >= 100) { await fade(false); return; }
    if (S.di === DAYS.length - 1) return ending(F().gang ? 'row' : S.debt >= 10 ? 'ledger' : 'another');
    S.di++; await startDay(true);
  }

  // --------------------------------------------------------------- lockdown
  let lock = null;
  async function lockdownStart() {
    const R = 'Raymond';
    await say(R, `Feel that? Yard's too quiet on one side and too loud on the other.`);
    await narr(`Over on the court, two men are standing too close. One of them owes. Everybody knows which one.`);
    G.npcs.f1.flail = 1; G.npcs.f2.flail = 1;
    await narr(`A shove. A second shove. Then the whole court folds inward like a fist closing.`);
    G.sfx.clang(); G.alarm = true; G.sfx.siren(true); $('red').classList.add('on');
    await narr(`2:15 PM. The alarm.`);
    await say(R, `Don't look at it. Don't get involved. Get to the house — NOW. Be behind your door when they count.`);
    complete('meet');
    lock = { t: 34 };
    G.setCrowd('lockdown');
    G.npcWalk('raymond', -1, -13.5, 4.2);
    G.moveNpc('nathan', 2.8, -16.5, 0, 'floor');
    G.moveNpc('alvarez', 5, -8, Math.PI, 'stand');
    $('timer').hidden = false;
    caption('LOCKDOWN — get back to your cell (W-3) before the count.', 6000);
    setTimeout(function () { if (lock) caption('Nathan is down just inside the dayroom door, caught in the crush.', 6000); }, 6500);
  }
  async function lockdownEnd(onTime) {
    const l = lock; lock = null; $('timer').hidden = true;
    await run(async function () {
      await fade(true);
      G.alarm = false; G.sfx.siren(false); $('red').classList.remove('on'); G.setCrowd('none');
      const cast = { raymond: [-15.6, -25.4, Math.PI / 2] }; G.placeCast(cast);
      G.teleport(-15.4, -27.4, Math.PI / 2);
      G.sfx.clang();
      await fade(false);
      if (onTime) { await narr(`The door racks shut behind you with two seconds to spare. You have never been so glad to be locked in.`); adj('trust', 3); }
      else { await narr(`The response team finds you out of place in the dayroom. Face down, zip ties, a knee between the shoulder blades. A disciplinary case for being where you weren't supposed to be.`); adj('heat', 14); adj('health', -6); }
      if (!F().nathanChoice && l) { await narr(`You ran right past Nathan on the floor. You only let yourself know that now.`); bond('nathan', -12); adj('mind', -5); F().nathanChoice = true; }
      await say('Raymond', `Stay away from the door. Whatever you hear tonight — you didn't.`);
      await narr(`The unit stays locked down nine days. Sack lunches through the slot. No showers until day four. No phones. No yard. Twenty-four hours a day, six feet from another man.`);
      const c = await choose([
        { id: 'ex', t: `Burpees and push-ups until the floor is wet.` },
        { id: 'read', t: `Read everything in the cell. Then read it again.` },
        { id: 'talk', t: `Ask Raymond how he's done nineteen years.` },
      ]);
      if (c === 'ex') { await narr(`Raymond counts for you from the top bunk without looking up from his book.`); adj('health', 8); adj('mind', -4); }
      if (c === 'read') { await narr(F().savedNathan ? `On day three a book slides under the door off the officer's cart, with a pencil note inside: "Glasses survived. So did I. — N."` : `Two westerns and the inmate handbook. You could now recite the grievance procedure in your sleep.`); adj('mind', 5); if (F().savedNathan) bond('nathan', 6); }
      if (c === 'talk') {
        await say('Raymond', `I had a daughter who was six when I came in. She's twenty-five. She writes every month. I do this year the same way I did the first: until the next letter.`);
        bond('raymond', 12); adj('mind', 3);
      }
      complete('cell');
    });
  }

  // ------------------------------------------------------------------- days
  const BASE = function (o) {
    const c = {
      clerk: [38, -6.9, 0], dee: [-6.35, -24, Math.PI / 2, 'sit'], dom2: [-3.65, -24, -Math.PI / 2, 'sit'],
      briggs: [-6, -15.6, Math.PI], cutter: [5, -35.35, 0, 'sit'], rowA: [6.35, -34, -Math.PI / 2, 'sit'], rowB: [3.65, -34, Math.PI / 2, 'sit'],
    };
    Object.keys(o).forEach(function (k) { if (o[k]) c[k] = o[k]; else delete c[k]; });
    return c;
  };
  const YARD_ROW = { cutter: [10.9, 4, -Math.PI / 2], rowA: [12.6, 6.3, -Math.PI / 2], rowB: [12.4, 1.7, -Math.PI / 2] };
  const RAY_CELL = [-15.6, -25.4, Math.PI / 2];
  function perks() {
    if (S.job === 'library') { adj('mind', 4); S.bond.nathan = Math.min(100, S.bond.nathan + 5); }
    if (S.job === 'kitchen') adj('health', 5);
    if (S.job === 'laundry') { item('ramen', 6); toast('+6 soups from pressing whites', 'good'); }
  }

  const DAYS = [
    {
      n: 1, title: 'INTAKE DAY', time: '06:42 AM · Harlan Creek Unit, Texas', sky: 'dawn', crowd: 'normal', ap: 0,
      spawn: [0, -14.6, Math.PI],
      cast: function () { return BASE({ alvarez: [1.3, -15.6, 0], raymond: RAY_CELL, nathan: [3.65, -24, Math.PI / 2, 'sit'], tiny: [-9.5, -20, Math.PI / 2] }); },
      obj: [{ id: 'cell', text: 'Find your cell — west side, W-3', at: CELL }, { id: 'raymond', text: 'Meet your cellmate', at: 'raymond' }],
      start: async function () {
        const A = 'Officer Alvarez';
        G.npcs.alvarez.known = true;
        await narr(`The first thing that hits you is the smell. Industrial cleaner, sweat, old concrete, and something you can't name. Then the noise — forty men, one television, somebody shouting down the tier.`);
        await say(A, `Life sentence?`);
        await narr(`You nod.`);
        await say(A, `First time?`);
        await say('Stefan', `Yes.`);
        await say(A, `Then you better start paying attention. Whatever you were outside these walls doesn't matter anymore. Nobody here cares what you drove, what you made, or who you knew.`);
        await say(A, `Your new home is right here. West side, cell three, bottom bunk. Your cellmate is Carter — nineteen years down. Listen to him more than you talk.`);
        caption(G.isTouch ? 'Drag the left side to walk, the right side to look. Tap the prompt to interact.' : 'WASD to walk · drag the mouse to look · Shift to run · E to interact', 9000);
      },
      end: async function () {
        await narr(`The lights never go out. They only dim. Somewhere down the tier a man is crying and trying not to be heard.`);
        await narr(`You lie on a mattress two inches thick and count the bars. There are fourteen. There will always be fourteen.`);
        adj('mind', -5);
      },
    },
    {
      n: 3, title: 'COMMISSARY', time: 'Friday, 09:10 AM', sky: 'day', crowd: 'normal', ap: 2,
      spawn: [-15.3, -27.3, Math.PI / 2],
      cast: function () { return BASE({ raymond: RAY_CELL, nathan: [-35.6, -3.9, Math.PI / 2], tiny: [6, -5, 0], alvarez: [-3.4, -9, 0] }); },
      obj: [
        { id: 'store', text: 'Buy supplies at the commissary window (east building)', at: { x: 38, z: -4.6 } },
        { id: 'library', text: 'Find something to read in the library (west building)', at: 'nathan' },
        { id: 'dom', text: "Lil' Dee is waving you over to the domino table", at: 'dee', opt: true },
      ],
      start: async function () {
        cash(75);
        await say('Raymond', `Friday. Store day. Your people put seventy-five on your books, and that has to last you.`);
        await say('Raymond', `Soap first. Then food. Soups are money in here — don't flash them, and don't lend them. That's how a lot of stupid problems start. Somebody thinks somebody owes somebody.`);
      },
      end: async function () { await narr(`Your first store bag sits in your locker like a small, sad fortune.`); },
    },
    {
      n: 5, title: 'THE YARD', time: 'Sunday, 01:30 PM', sky: 'day', crowd: 'normal', ap: 2,
      spawn: [-15.3, -27.3, Math.PI / 2],
      cast: function () { return BASE(Object.assign({ raymond: [-7, 5.6, Math.PI * 0.75], nathan: [-20, 11.4, 0], tiny: [1.6, -6.5, Math.PI], alvarez: [24, -6, -Math.PI / 2] }, YARD_ROW)); },
      obj: [
        { id: 'yard', text: 'Step out onto the yard', at: { x: 0, z: -8 } },
        { id: 'cutter', text: 'Cutter wants a word — east picnic table', at: 'cutter' },
        { id: 'nathan5', text: 'Nathan is over by the pull-up bars', at: 'nathan', opt: true },
      ],
      start: async function () {
        if (!S.inv.soap) { await narr(`Raymond left a bar of his own soap on your bunk. No note. Message received.`); adj('rep', -4); item('soap', 1); }
        await narr(`First rec call for new arrivals. Out there, people don't just stand wherever they want. You are about to find out where you stand.`);
      },
      end: async function () { await narr(`You fall asleep going over every face on the yard, like studying for a test nobody will tell you the date of.`); },
    },
    {
      n: 8, title: 'THE OFFICER', time: 'Wednesday, 10:45 AM', sky: 'overcast', crowd: 'normal', ap: 2,
      spawn: [-11, -27, Math.PI / 2],
      cast: function () { return BASE({ raymond: [-6.35, -34, Math.PI / 2, 'sit'], nathan: [-35.6, -3.9, Math.PI / 2], tiny: [8, -19, 0], alvarez: [3, -6, 0] }); },
      obj: [
        { id: 'briggs', text: 'Officer Briggs is waiting at his desk', at: 'briggs' },
        { id: 'job', text: 'See Officer Alvarez on the yard about a work assignment', at: 'alvarez' },
      ],
      start: async function () {
        G.npcs.briggs.known = true;
        await narr(`You're on your way to the showers when a voice drops across the dayroom like a hand on your shoulder.`);
        await say('Officer Briggs', `Reed. Step over here a minute.`);
      },
      end: async function () { await narr(F().mule ? `Fifty dollars. You check the number on the kiosk three times. It doesn't feel like money. It feels like a hook.` : `You said no to a man with keys. You lie awake working out what that costs.`); },
    },
    {
      n: 14, title: 'LOCKDOWN', time: 'Tuesday, 02:05 PM', sky: 'hot', crowd: 'normal', ap: 0,
      spawn: [-17, 17, Math.PI / 2],
      cast: function () {
        return BASE(Object.assign({ raymond: [-7, 5.6, Math.PI * 0.75], nathan: [3, -5, Math.PI], tiny: [10, 15, 0], alvarez: [22, -4, -Math.PI / 2], briggs: [-24, 26, 0.6],
          f1: [13, 18.5, Math.PI / 2], f2: [14.1, 18.5, -Math.PI / 2] }, YARD_ROW));
      },
      obj: [
        { id: 'meet', text: 'Raymond is nodding you over — west picnic table', at: 'raymond' },
        { id: 'cell', text: 'LOCKDOWN — get to your cell (W-3)', at: CELL, if: function () { return !!S.done.meet; } },
      ],
      start: async function () {
        perks();
        await narr(`Two weeks in. You've learned the schedule: chow, count, rec, count, chow, count. Today the air on the yard feels wrong, and you don't know enough yet to know why.`);
      },
      end: async function () { await narr(`Day nine of lockdown ends the way it began: a door, a key, a count.`); },
    },
    {
      n: 30, title: 'REPUTATION', time: 'Thursday, 06:50 PM', sky: 'dusk', crowd: 'normal', ap: 2,
      spawn: [-15.3, -27.3, Math.PI / 2],
      cast: function () {
        return BASE({ raymond: RAY_CELL, nathan: [23.4, 6, -Math.PI / 2], tiny: [0, -20, Math.PI], alvarez: [-3.4, -9, 0], briggs: F().grievance || F().toldTruth ? null : [-6, -15.6, Math.PI] });
      },
      obj: [
        { id: 'rep', text: 'Ask Raymond what the building thinks of you', at: 'raymond' },
        { id: 'nathan30', text: 'Nathan is waiting by the bleachers', at: 'nathan' },
        { id: 'debt', text: 'Tiny is collecting for the domino table', at: 'tiny', if: function () { return S.debt > 0 || S.done.debt; } },
        { id: 'cutter30', text: 'Give Cutter your answer', at: 'cutter', if: function () { return F().cutterPending || S.done.cutter30; } },
      ],
      start: async function () {
        perks();
        if (F().family) { cash(40); await narr(`Your sister put forty dollars on your books, with a message: "Still here. Keep writing."`); }
        if (F().mule) {
          await narr(`They hit the tier at 5 AM. Somebody in E-4 got caught and started talking. Officer Alvarez stands in your doorway while two others take your mattress apart.`);
          await say('Officer Alvarez', `Somebody walked a package across my dayroom three weeks ago, Reed. Camera says it was you. I want to hear who handed it to you.`);
          const c = await choose([{ id: 't', t: `Tell her the truth about Briggs.` }, { id: 's', t: `"I don't know anything about that."` }]);
          if (c === 't') { await narr(`Briggs is walked off the unit before lunch. By dinner, everybody knows who talked. Doing the right thing and doing the safe thing were never the same thing in here.`); adj('heat', -8); adj('trust', 8); adj('rep', -12); F().toldTruth = true; G.npcs.briggs.g.visible = false; }
          else { await say('Officer Alvarez', `Then it's all yours.`); await narr(`A major case. Commissary restriction, and your name on a list in the captain's office.`); adj('heat', 25); cash(-Math.min(S.money, 30)); }
        }
        if (F().grievance) { await narr(`Briggs is gone from A-Block. Reassigned, they say. Nobody says why. Somebody knows why.`); adj('trust', 5); adj('rep', -3); }
        await narr(`Thirty days. The men on the tier have stopped calling you "new guy." You haven't decided if that's better.`);
      },
      end: async function () { await narr(`One month down. You do the arithmetic on the rest and then make yourself stop.`); },
    },
    {
      n: 180, title: 'THE DREAM SELLER', time: 'Six months in · 03:20 PM', sky: 'hot', crowd: 'normal', ap: 2,
      spawn: [-2, -6, 0],
      cast: function () {
        const nat = F().nathan === 'none' ? [-35.6, -3.9, Math.PI / 2] : [23.4, 6, -Math.PI / 2];
        return BASE(Object.assign({ raymond: [-7, 5.6, Math.PI * 0.75], nathan: nat, duke: [-3, 14, Math.PI], tiny: [12, 20, 0], alvarez: [24, -6, -Math.PI / 2],
          briggs: F().grievance || F().toldTruth ? null : [-6, -15.6, Math.PI] }, YARD_ROW));
      },
      obj: [
        { id: 'duke', text: 'A man called Duke has been asking for you — middle of the yard', at: 'duke' },
        { id: 'advice', text: 'Ask Raymond or Nathan about Duke first', at: 'raymond', opt: true },
        { id: 'hold', text: 'Cutter has a job for you', at: 'cutter', if: function () { return !!F().gang; } },
      ],
      start: async function () {
        perks();
        await narr(`Six months. Summer in Texas, no air conditioning; the cell holds a hundred and four degrees at midnight. You have stopped counting days and started counting store days.`);
        let m = -14;
        if (F().family) m += 5; if (F().nathan === 'love') m += 8; if (F().nathan === 'friend') m += 6; if (S.bond.raymond >= 15) m += 3;
        if (m < 0) { await narr(m <= -9 ? `Some mornings you can't remember your sister's voice. You are disappearing a little at a time, and nobody is there to notice.` : `It wears on you. But there are people who would notice if you stopped showing up, and that turns out to be most of what holds a man together.`); adj('mind', m); }
        else { await narr(`It should have hollowed you out by now. It hasn't. You know exactly who to thank for that.`); adj('mind', 3); }
        if (F().family) cash(40);
        if (F().enemy && !F().gang) { await narr(`The Row hasn't forgotten. In June somebody caught you alone on the stairs. You still can't lift your left arm all the way.`); adj('health', -14); }
      },
      end: async function () { await narr(`That night you look at the door for a long time. It's just a door. It was always just a door.`); },
    },
    {
      n: 365, title: 'THE FIRST YEAR', time: 'One year in · 07:40 PM', sky: 'evening', crowd: 'few', ap: 0,
      spawn: [-11, -27, Math.PI / 2],
      cast: function () {
        return BASE({ raymond: [-6.35, -34, Math.PI / 2, 'sit'], nathan: [3.65, -24, Math.PI / 2, 'sit'], tiny: [8, -19, 0], alvarez: [1.3, -15.6, Math.PI], briggs: null });
      },
      obj: [
        { id: 'ray365', text: 'Sit down with Raymond', at: 'raymond' },
        { id: 'nathan365', text: 'Nathan is at his table with the paperback', at: 'nathan', opt: true },
      ],
      start: async function () {
        perks();
        await narr(`One year. You know when meals are served, when count clears, when the phones open. You've learned to hear trouble before it reaches your door.`);
        await narr(`You walked in here not knowing which table to sit at. Tonight you cross the dayroom without thinking about it.`);
      },
    },
  ];

  async function startDay(fromSleep) {
    const d = DAYS[S.di];
    busy = true; G.locked = true;
    if (!fromSleep) await fade(true);
    S.done = {}; S.ap = d.ap; lock = null; $('timer').hidden = true;
    G.alarm = false; G.sfx.siren(false); $('red').classList.remove('on');
    G.setSky(d.sky); G.setCrowd(d.crowd); G.placeCast(d.cast());
    ['raymond', 'nathan', 'alvarez', 'briggs', 'cutter', 'duke'].forEach(function (k) {
      if ((k === 'raymond' && S.di > 0) || (k === 'nathan' && S.di > 1) || (k === 'alvarez') || (k === 'briggs' && S.di > 3) || (k === 'cutter' && S.di > 2)) G.npcs[k].known = true;
    });
    G.npcs.dee.known = G.npcs.dom2.known = G.npcs.tiny.known = S.di > 1;
    G.teleport(d.spawn[0], d.spawn[1], d.spawn[2]);
    save(); hud(); $('objlist').innerHTML = ''; G.setMarker(null);
    $('hud').hidden = false;
    await card('DAY ' + d.n, d.title + '  ·  ' + d.time, 2800);
    G.sfx.clang();
    await fade(false);
    busy = false;
    await run(d.start);
  }

  // ---------------------------------------------------------------- endings
  let endingShown = false;
  const ENDINGS = {
    dream: ['THE DREAM SELLER', [
      `The door was unlocked, exactly as Duke promised. That was the last true thing he told you.`,
      `There was no truck. There was a response team, already waiting, and a captain holding a report that had been written before you ever left your cell. Duke got a single cell and extra phone time. You got an attempted-escape charge stacked on a life sentence.`,
      `Administrative segregation is a room the size of a parking space, twenty-three hours a day. Through the slot, weeks later, a book arrives off the library cart. There's no note in it. You understand that the note is the book.`,
      `The man who offered you freedom was more dangerous than the sentence.`]],
    adseg: ['ADMINISTRATIVE SEGREGATION', [
      `There's a number, somewhere in a captain's office, that tracks how much trouble a man is. Yours finally got high enough.`,
      `They reclassify you on a Tuesday. No hearing you'd recognize as one. A single cell, a steel door, a slot. Twenty-three hours a day, and the twenty-fourth in a cage with a pull-up bar and a square of sky.`,
      `You still have a life sentence. Now you will serve it alone.`]],
    infirmary: ['THE INFIRMARY', [
      `The body keeps its own disciplinary record, and yours ran out of room.`,
      `You wake up under a light that never turns off, cuffed by one ankle to a hospital bed, and a nurse who has seen too many of you tells you how close it was.`,
      `They transfer you to the medical unit two hundred miles away. Whatever you had started to build at Harlan Creek — a name, a routine, a person who would notice you were gone — stays behind.`]],
    walls: ['THE WALLS WIN', [
      `Nobody did this to you. That's the cruelty of it. It was the count, and the lights, and the door, and the count again.`,
      `One morning you don't get up for chow. Then another. Raymond talks to the officers; the officers call psych; psych moves you to an observation cell with a paper gown and a camera.`,
      `Prison took your freedom the day you walked in. It took the rest so slowly you never felt it go.`]],
    row: ['PROPERTY OF THE ROW', [
      `You made it through the first year. Nobody touches you now. Nobody talks to you much, either — not the way they used to.`,
      `You eat at Cutter's table. You hold what you're told to hold and stand where you're told to stand. You have protection, and you have learned exactly what it costs: every yes you'll ever have, paid in advance.`,
      `Raymond still nods to you across the dayroom. He doesn't push the stool out with his foot anymore.`,
      `You are safe. You are not yours.`]],
    ledger: ['THE LEDGER', [
      `You made it through the first year, and you owe for every day of it.`,
      `The number never went down. It doesn't work like that. Your store bag goes straight from the window to the table; your sister's money has other men's names on it before it lands.`,
      `Raymond was right. A man who owes isn't a man in here. He's an account.`]],
  };
  async function ending(kind) {
    endingShown = true; busy = true; G.locked = true; closeDialog(); lock = null;
    G.sfx.siren(false); G.alarm = false; $('red').classList.remove('on'); $('timer').hidden = true;
    await fade(true);
    let title, paras;
    if (kind === 'another') {
      title = 'ANOTHER DAY'; paras = [];
      paras.push(`One year. You avoided the gangs, the debts and the worst of the trouble. You are not the toughest man in the building. You never needed to be.`);
      if (F().nathan === 'love') paras.push(`Nathan saves you the seat on the bleachers with the best view of the sky. Nobody says what the two of you are. Nobody needs to. On the worst nights you think about a shoulder against yours, and the night passes.`);
      else if (F().nathan === 'friend') paras.push(`Nathan keeps a stack of books behind the library desk with your name on it. You have a brother in here — a thing you didn't have on the outside, and found in the last place on earth you'd have looked.`);
      else paras.push(`You kept everyone at arm's length, and it worked. Nobody can use what you never gave them. Some nights the quiet in your own head is the loudest thing on the tier.`);
      if (S.bond.raymond >= 18) paras.push(`Raymond says you're the first cellmate in nineteen years he hasn't asked to have moved. From Raymond, that is practically a wedding toast.`);
      if (F().family) paras.push(`Your sister still writes. You still write back. A piece of you lives in an envelope, travelling.`);
      if (S.job === 'library') paras.push(`You push the book cart on Tuesdays and Thursdays. Men who would never speak to you on the yard ask, quietly, if you've got anything good.`);
      paras.push(`That evening you look at the cell door, and for the first time you understand. You're serving a life sentence. You don't have to let prison take the person you are.`);
    } else { title = ENDINGS[kind][0]; paras = ENDINGS[kind][1]; }
    $('end-title').textContent = title;
    $('end-body').innerHTML = ''; paras.forEach(function (p) { const e = document.createElement('p'); e.textContent = p; $('end-body').appendChild(e); });
    const st = S.stats;
    $('end-stats').textContent = 'Day ' + DAYS[S.di].n + '  ·  Health ' + st.health + '  ·  Mind ' + st.mind + '  ·  Reputation ' + st.rep + '  ·  Trust ' + st.trust + '  ·  Heat ' + st.heat;
    $('hud').hidden = true; $('prompt').hidden = true; G.setMarker(null);
    clearSave(); $('end').hidden = false;
  }

  // -------------------------------------------------------- per-frame logic
  let nearest = null;
  const dayTriggers = {
    1: [
      { once: 'c1', test: function (p) { return Math.hypot(p.x - 4, p.z + 24) < 4; }, fn: function () { caption('A man sits alone with a paperback, turning pages like nothing in here can reach him.'); } },
      { once: 'c2', test: function (p) { return Math.hypot(p.x - 5, p.z + 33) < 5.5; }, fn: function () { caption("A table of men who don't look up — and everyone else walking a wide circle around them."); } },
      { once: 'c3', test: function (p) { return Math.hypot(p.x + 9.5, p.z + 20) < 4; }, fn: function () { caption("A younger inmate tracks you all the way across the dayroom. He doesn't blink."); } },
      { once: 'cell', test: function (p) { return p.x < -13.3 && Math.abs(p.z + 27) < 2.8; }, fn: function () { complete('cell'); } },
    ],
    5: [{
      once: 'yard', test: function (p) { return p.z > -10.5 && Math.abs(p.x) < 6 && p.z < 0; }, fn: function () {
        run(async function () {
          const t = G.npcs.tiny; face(t);
          await narr(`Sun, dust, forty men in white. Before your eyes adjust, the kid from the dayroom is in front of you.`);
          await say('Tiny', `You rolling with anybody?`);
          const c = await choose([
            { id: 'solo', t: `"I'm solo. Just doing my time."` },
            { id: 'what', t: `"What do you mean?"` },
            { id: 'who', t: `"Who's asking?"` },
          ]);
          if (c === 'solo') { await say('Tiny', `Solo. Okay. For now.`); adj('rep', 5); }
          if (c === 'what') {
            if (S.bond.raymond >= 6) { await say('Raymond', `He's new. Leave him alone.`); await narr(`Raymond doesn't raise his voice. Tiny finds somewhere else to be.`); await say('Raymond', `He's asking who you belong to. The answer is nobody. Say it like you mean it next time.`); adj('rep', -1); }
            else { await say('Tiny', `Oh, you're fresh fresh.`); await narr(`He laughs and walks off to tell somebody. You've been filed under a word, and you don't know which.`); adj('rep', -5); F().mark = true; }
          }
          if (c === 'who') { await say('Tiny', `Somebody you'll see again.`); adj('rep', 3); adj('heat', 2); F().mark = true; }
          complete('yard');
        });
      },
    }],
  };
  G.updates.push(function (dt) {
    if (!S || endingShown) return;
    const p = G.player;
    // marker arrow
    const m = G.marker, ar = $('arrow');
    if (m && !busy) {
      const dx = m.x - p.x, dz = m.z - p.z, dist = Math.hypot(dx, dz), y = G.cam.yaw;
      const fwd = dx * -Math.sin(y) + dz * -Math.cos(y), right = dx * Math.cos(y) + dz * -Math.sin(y);
      ar.hidden = dist < 3; $('arrow-i').style.transform = 'rotate(' + Math.atan2(right, fwd) + 'rad)'; $('arrow-d').textContent = Math.round(dist) + ' m';
    } else ar.hidden = true;
    if (busy) return;
    // lockdown
    if (lock) {
      lock.t -= dt; $('timer').textContent = 'COUNT IN ' + Math.max(0, Math.ceil(lock.t)) + 's';
      if (p.x < -13.3 && Math.abs(p.z + 27) < 2.8) return void lockdownEnd(true);
      if (lock.t <= 0) return void lockdownEnd(false);
      if ((F().enemy || F().mark) && !lock.blocked && p.z < -13.2 && p.z > -19 && Math.abs(p.x) < 6) {
        lock.blocked = true;
        G.moveNpc('rowA', p.x - 1.4, p.z - 1.2, 0, 'stand');
        run(async function () {
          face(G.npcs.rowA);
          await narr(`A Row soldier steps out of the crowd and into your path. In the noise, nobody would ever know who started it.`);
          const c = await choose([{ id: 'a', t: `Shoulder through him and keep running.` }, { id: 'b', t: `Hands up, go around, lose the seconds.` }, { id: 'c', t: `Hit him first.` }]);
          if (c === 'a') { await narr(`It's like hitting a door. But doors open.`); adj('health', -10); adj('rep', 3); lock.t -= 3; }
          if (c === 'b') { await narr(`He lets you pass, smiling. You'll be thinking about that smile for a week.`); adj('rep', -3); lock.t -= 7; }
          if (c === 'c') { await narr(`You've never hit a man in the face before. It hurts your hand more than you expected. A camera in the corner sees all of it.`); adj('health', -6); adj('heat', 14); adj('rep', 7); lock.t -= 4; }
        });
        return;
      }
    }
    // triggers
    const tr = dayTriggers[D()];
    if (tr) for (let i = 0; i < tr.length; i++) { const t = tr[i]; if (!S.done['t_' + t.once] && t.test(p)) { S.done['t_' + t.once] = true; t.fn(); if (busy) return; } }
    // nearest interactable
    let best = null, bd = 1e9, bl = null;
    for (let i = 0; i < things.length; i++) {
      const t = things[i], q = t.pos(), d0 = Math.hypot(q.x - p.x, q.z - p.z);
      const d = m && Math.abs(q.x - m.x) + Math.abs(q.z - m.z) < 0.2 ? d0 * 0.4 : d0; // prefer the current objective
      if (d0 < t.r && d < bd) { const l = t.label(); if (l) { best = t; bd = d; bl = l; } }
    }
    nearest = best;
    const pr = $('prompt');
    if (best) { pr.hidden = false; $('prompt-t').textContent = bl; } else pr.hidden = true;
  });
  function interact() { if (busy || !nearest) return; const t = nearest; nearest = null; run(t.act); }
  $('prompt').addEventListener('click', interact);

  G.onKey = function (e) {
    if (e.repeat) return;
    if (e.code === 'KeyM') return void $('mute').click();
    if (proseSkip && (e.code === 'Space' || e.code === 'Enter')) return void proseSkip();
    if (!$('dialog').hidden) {
      if (choiceBtns.length) { const n = parseInt(e.key, 10); if (n >= 1 && n <= choiceBtns.length) choiceBtns[n - 1].click(); }
      else if (e.code === 'Space' || e.code === 'Enter' || e.code === 'KeyE') advance();
      return;
    }
    if (e.code === 'KeyE' || e.code === 'Enter') interact();
  };
  let muted = false;
  $('mute').addEventListener('click', function () { muted = !muted; G.setMuted(muted); $('mute').textContent = muted ? 'Sound off' : 'Sound on'; });

  // ------------------------------------------------------------------ title
  async function begin(saved) {
    G.audioInit();
    $('title').hidden = true; $('end').hidden = true; endingShown = false;
    S = saved || newState(); G.S = S;
    if (!saved) {
      await fade(true);
      await prose([
        `The shackles are the first thing you notice. Not the handcuffs. Not the guards. Not the concrete walls. The sound — chains dragging across the floor.`,
        `You spent eleven months fighting the case. This morning a judge sentenced you to life without the possibility of parole.`,
        `Your name is Stefan Reed. You are thirty-two years old. You have never been inside a prison before.`,
        `The gate opens. Then it closes.`,
      ]);
      G.sfx.clang();
      await startDay(true);
    } else await startDay(false);
  }
  $('new').addEventListener('click', function () { begin(null); });
  $('cont').addEventListener('click', function () { begin(loadSave()); });
  $('again').addEventListener('click', function () { $('fade').classList.remove('on'); begin(null); });

  if (G.isTouch) document.documentElement.classList.add('touch');
  G.boot();
  buildThings();
  S = newState(); G.S = S;
  $('cont').hidden = !loadSave();
  // test hooks
  G.debug = { state: function () { return S; }, goto: function (i) { S.di = i; return startDay(false); }, advance: advance, busy: function () { return busy; }, ending: ending };
})();

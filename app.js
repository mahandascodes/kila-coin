/* Budgetly v2 — Kenya Edition
   Personal + Business ledgers · KSh · M-Pesa SMS import · Savings goals.
   All data stored locally on the device (localStorage). */

(function () {
  'use strict';

  var STORE = 'budgetly.v2';

  var PALETTE = [
    '#0f766e', '#0ea5e9', '#8b5cf6', '#ec4899', '#f59e0b',
    '#10b981', '#ef4444', '#84cc16', '#f97316', '#14b8a6',
    '#a855f7', '#3b82f6'
  ];

  var CAT_RULES = [
    { re: /ziidi|mmf|money market|unit trust|invest|sacco|savings|save/i, cat: 'Savings' },
    { re: /kplc|kenya power|token|umeme|water|sewer|garbage/i, cat: 'Utilities' },
    { re: /naivas|carrefour|quickmart|chandarana|tuskys|supermarket|grocer|market|butcher|greengrocer|sokoni/i, cat: 'Groceries' },
    { re: /uber|bolt|little|matatu|fuel|shell|total|kenol|petrol|diesel|parking|taxi|bus/i, cat: 'Transport' },
    { re: /safaricom|airtel|telkom|airtime|bundles|internet|wifi|faiba|zuku/i, cat: 'Airtime & Internet' },
    { re: /netflix|showmax|spotify|dstv|gotv|cinema|movie|game/i, cat: 'Entertainment' },
    { re: /rent|landlord|housing|mortgage|caretaker/i, cat: 'Housing' },
    { re: /kcb|equity|co-?op|absa|ncba|stanbic|bank|charge|transaction cost|fee/i, cat: 'Fees & Charges' },
    { re: /hospital|clinic|pharmacy|chemist|doctor|health|dawa/i, cat: 'Health' },
    { re: /restaurant|hotel|cafe|java|kfc|pizza|chicken|food|canteen/i, cat: 'Food & Drink' },
    { re: /jumia|kilimall|shop|store|mall|boutique/i, cat: 'Shopping' }
  ];

  // ---------- utils ----------
  function uid() {
    return 'x' + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
  }
  function $(s) { return document.querySelector(s); }
  function $$(s) { return Array.prototype.slice.call(document.querySelectorAll(s)); }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (m) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
    });
  }
  function fmt(n) {
    n = Number(n) || 0;
    var neg = n < 0;
    var abs = Math.abs(n);
    var str = abs.toLocaleString('en-KE', {
      minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
      maximumFractionDigits: 2
    });
    return (neg ? '-' : '') + 'KSh ' + str;
  }
  function num(v) { var n = parseFloat(v); return isFinite(n) ? n : 0; }
  function pad(n) { return n < 10 ? '0' + n : '' + n; }
  function todayISO() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }
  function monthKeyNow() {
    var d = new Date();
    return d.getFullYear() + '-' + pad(d.getMonth() + 1);
  }
  function monthLabel(key) {
    var parts = String(key).split('-');
    var d = new Date(Number(parts[0]), Number(parts[1]) - 1, 1);
    return d.toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  }
  function monthOf(dateISO) { return String(dateISO || '').slice(0, 7); }
  function shortDate(iso) {
    var p = String(iso).split('-');
    if (p.length < 3) return iso;
    var d = new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  }

  // ---------- default data ----------
  function mkCats(list) {
    return list.map(function (c, i) {
      return { id: uid(), name: c[0], budget: c[1], color: PALETTE[i % PALETTE.length] };
    });
  }

  function sampleTx(ledger) {
    var now = new Date();
    function d(day) {
      return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(day);
    }
    var base = [
      { type: 'expense', amount: 25000, category: 'Housing', merchant: 'Rent — Landlord', date: d(2) },
      { type: 'expense', amount: 1250, category: 'Groceries', merchant: 'NAIVAS SUPERMARKET', date: d(4) },
      { type: 'expense', amount: 800, category: 'Utilities', merchant: 'KPLC PREPAID TOKEN', date: d(5) },
      { type: 'expense', amount: 350, category: 'Transport', merchant: 'BOLT RIDE', date: d(6) },
      { type: 'expense', amount: 500, category: 'Airtime & Internet', merchant: 'SAFARICOM BUNDLES', date: d(7) },
      { type: 'expense', amount: 2400, category: 'Groceries', merchant: 'QUICKMART', date: d(9) },
      { type: 'expense', amount: 1200, category: 'Entertainment', merchant: 'NETFLIX', date: d(10) },
      { type: 'income', amount: 65000, category: 'Income', merchant: 'Salary — Employer', date: d(1) }
    ];
    if (ledger === 'business') {
      base = [
        { type: 'income', amount: 120000, category: 'Sales', merchant: 'Customer payment — Invoice 014', date: d(3) },
        { type: 'expense', amount: 40000, category: 'Stock & Inventory', merchant: 'Supplier — Wholesale', date: d(4) },
        { type: 'expense', amount: 15000, category: 'Rent', merchant: 'Shop rent', date: d(2) },
        { type: 'expense', amount: 6000, category: 'Transport & Delivery', merchant: 'Delivery — Boda', date: d(6) },
        { type: 'expense', amount: 25000, category: 'Salaries', merchant: 'Staff salaries', date: d(5) },
        { type: 'expense', amount: 3000, category: 'Marketing', merchant: 'Facebook Ads', date: d(8) },
        { type: 'expense', amount: 900, category: 'Fees & Charges', merchant: 'M-PESA transaction cost', date: d(8) }
      ];
    }
    return base.map(function (t) {
      return {
        id: uid(), type: t.type, amount: t.amount, category: t.category,
        merchant: t.merchant, date: t.date, source: 'sample', code: ''
      };
    });
  }

  function defaultState() {
    return {
      version: 2,
      active: 'personal',
      month: monthKeyNow(),
      ledgers: {
        personal: {
          income: 80000,
          categories: mkCats([
            ['Housing', 25000], ['Utilities', 5000], ['Groceries', 18000],
            ['Transport', 8000], ['Airtime & Internet', 3000], ['Entertainment', 4000],
            ['Health', 4000], ['Savings', 10000], ['Other', 3000]
          ]),
          transactions: sampleTx('personal'),
          goals: [
            { id: uid(), name: 'Emergency Fund', target: 100000, saved: 35000, date: '' },
            { id: uid(), name: 'Family Holiday', target: 60000, saved: 12000, date: '' }
          ]
        },
        business: {
          income: 150000,
          categories: mkCats([
            ['Stock & Inventory', 45000], ['Rent', 15000], ['Utilities', 5000],
            ['Transport & Delivery', 8000], ['Salaries', 25000], ['Marketing', 6000],
            ['Fees & Charges', 2000], ['Other', 4000]
          ]),
          transactions: sampleTx('business'),
          goals: [
            { id: uid(), name: 'New Equipment', target: 200000, saved: 45000, date: '' }
          ]
        }
      }
    };
  }

  // ---------- load / save ----------
  function normalize(s) {
    if (!s || typeof s !== 'object' || !s.ledgers) return defaultState();
    ['personal', 'business'].forEach(function (k) {
      var l = s.ledgers[k];
      if (!l) { s.ledgers[k] = defaultState().ledgers[k]; return; }
      l.income = num(l.income);
      l.categories = Array.isArray(l.categories) ? l.categories : [];
      l.categories.forEach(function (c, i) {
        c.id = c.id || uid();
        c.name = String(c.name || 'Category');
        c.budget = num(c.budget);
        c.color = c.color || PALETTE[i % PALETTE.length];
      });
      l.transactions = Array.isArray(l.transactions) ? l.transactions : [];
      l.transactions.forEach(function (t) {
        t.id = t.id || uid();
        t.type = t.type === 'income' ? 'income' : 'expense';
        t.amount = num(t.amount);
        t.category = t.category || 'Other';
        t.merchant = String(t.merchant || '');
        t.date = t.date || todayISO();
        t.source = t.source || 'manual';
        t.code = t.code || '';
      });
      l.goals = Array.isArray(l.goals) ? l.goals : [];
      l.goals.forEach(function (g) {
        g.id = g.id || uid();
        g.name = String(g.name || 'Goal');
        g.target = num(g.target);
        g.saved = num(g.saved);
        g.date = g.date || '';
      });
    });
    s.active = s.active === 'business' ? 'business' : 'personal';
    s.month = /^\d{4}-\d{2}$/.test(s.month || '') ? s.month : monthKeyNow();
    return s;
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE);
      if (!raw) return defaultState();
      return normalize(JSON.parse(raw));
    } catch (e) { return defaultState(); }
  }

  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {}
  }

  var state = load();
  var txFilter = 'all';
  var preview = [];

  function ledger() { return state.ledgers[state.active]; }

  // ---------- derived ----------
  function monthTx() {
    var m = state.month;
    return ledger().transactions.filter(function (t) { return monthOf(t.date) === m; });
  }

  function totals() {
    var l = ledger();
    var txs = monthTx();
    var spent = 0, received = 0;
    txs.forEach(function (t) {
      if (t.type === 'income') received += t.amount;
      else spent += t.amount;
    });
    var budget = l.categories.reduce(function (s, c) { return s + c.budget; }, 0);
    var declared = l.income;
    var income = declared > 0 ? declared : received;
    return {
      income: income,
      declared: declared,
      received: received,
      budget: budget,
      spent: spent,
      left: income - spent,
      unallocated: income - budget,
      budgetLeft: budget - spent
    };
  }

  function spentByCategory() {
    var map = {};
    monthTx().forEach(function (t) {
      if (t.type !== 'expense') return;
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return map;
  }

  // ---------- M-Pesa parser ----------
  function splitMessages(text) {
    // Normalise: strip CRs, collapse runs of spaces/tabs, trim.
    var s = String(text).replace(/\r/g, '').replace(/[ \t]+/g, ' ').trim();
    if (!s) return [];

    // Find every "<CODE> Confirmed" boundary. We can't use a lookahead split
    // here: "UK2690GZRR" would also match "K2690GZRR" one character in and
    // chop the code in half. So scan for real match positions instead.
    var re = /(?:^|[^A-Za-z0-9])([A-Z0-9]{8,12})\s+Confirmed/g;
    var starts = [];
    var hit;
    while ((hit = re.exec(s)) !== null) {
      starts.push(hit.index + hit[0].length - hit[0].replace(/^[^A-Za-z0-9]/, '').length);
    }

    if (starts.length) {
      var out = [];
      for (var i = 0; i < starts.length; i++) {
        var end = (i + 1 < starts.length) ? starts[i + 1] : s.length;
        var chunk = s.slice(starts[i], end).replace(/[\s/]+$/, '').trim();
        if (chunk) out.push(chunk);
      }
      return out;
    }

    // Fallback: no codes present — split on each "Confirmed." marker.
    var chunks = s.split(/(?=Confirmed\.)/i)
      .map(function (p) { return p.trim(); })
      .filter(Boolean);
    return chunks.length ? chunks : [s];
  }

  function titleCase(s) {
    if (!s) return s;
    // only fix names that arrive entirely lowercase (e.g. "justin mutwiri")
    if (s !== s.toLowerCase()) return s;
    return s.replace(/\b[a-z]/g, function (m) { return m.toUpperCase(); });
  }

  function cleanMerchant(s) {
    return titleCase(
      String(s).replace(/\s+/g, ' ').replace(/[.,;:\s]+$/, '').trim()
    );
  }

  // Returns the ledger category name that a rule points at, or null if no rule matches.
  function ruleCategory(text) {
    if (!text) return null;
    var names = ledger().categories.map(function (c) { return c.name; });
    for (var i = 0; i < CAT_RULES.length; i++) {
      if (CAT_RULES[i].re.test(text)) {
        var want = CAT_RULES[i].cat;
        for (var j = 0; j < names.length; j++) {
          if (names[j].toLowerCase() === want.toLowerCase()) return names[j];
        }
        for (var k = 0; k < names.length; k++) {
          if (names[k].toLowerCase().indexOf(want.split(' ')[0].toLowerCase()) !== -1) return names[k];
        }
      }
    }
    return null;
  }

  function guessCategory(text) {
    var hit = ruleCategory(text);
    if (hit) return hit;
    var names = ledger().categories.map(function (c) { return c.name; });
    for (var o = 0; o < names.length; o++) {
      if (/^other$/i.test(names[o])) return names[o];
    }
    return names[0] || 'Other';
  }

  function parseMessage(rawMsg) {
    // --- 0. normalise spacing quirks Safaricom loves to throw at us ---
    // "AM.New M-PESA", "Confirmed.You have" -> insert a space after the full stop.
    var msg = String(rawMsg)
      .replace(/\r/g, '')
      .replace(/[ \t]+/g, ' ')
      .replace(/\.(?=[A-Za-z])/g, '. ')
      .replace(/\s+/g, ' ')
      .trim();

    // --- 1. amount: first "Ksh<number>" in the message ---
    var am = msg.match(/ksh\s*([0-9][0-9,]*(?:\.[0-9]{1,2})?)/i);
    if (!am) return null;
    var amount = parseFloat(am[1].replace(/,/g, ''));
    if (!isFinite(amount) || amount <= 0) return null;

    // --- 2. direction ---
    var lower = msg.toLowerCase();
    var type = 'expense';
    if (/you have received|received from|received ksh|money received/.test(lower)) type = 'income';
    else if (/withdraw/.test(lower)) type = 'expense';

    // --- 3. merchant / counterparty ---
    var merchant = '';
    var TERMINATORS = '\\s+on\\s+\\d|\\s+for\\s+account|\\s+New M-?PESA|\\s+Transaction cost|\\s+Amount you can transact|\\s*\\.\\s*$|$';
    var patterns = [
      /(?:sent to|paid to|pay to|received from|payment to|transfer to)\s+(.+?)(?=PHONE_OR_END)/i,
      /received\s+ksh\s*[0-9][0-9,]*(?:\.[0-9]{1,2})?\s+from\s+(.+?)(?=PHONE_OR_END)/i,
      /from\s+(.+?)(?=PHONE_OR_END)/i
    ];
    for (var p = 0; p < patterns.length && !merchant; p++) {
      var src = patterns[p].source.replace('PHONE_OR_END', '\\s+\\+?\\d{9,}|' + TERMINATORS);
      var m = msg.match(new RegExp(src, 'i'));
      if (m && m[1]) merchant = m[1];
    }

    // strip a trailing phone number and any trailing punctuation
    merchant = merchant
      .replace(/\s+\+?\d{9,}\s*$/, '')
      .replace(/\s+for\s+account.*$/i, '')
      .replace(/[\s.,;:]+$/, '')
      .trim();
    merchant = cleanMerchant(merchant);

    if (!merchant) {
      merchant = type === 'income' ? 'M-Pesa received' : 'M-Pesa payment';
    }

    // --- 4. date (d/m/yy or d/m/yyyy) ---
    var dateISO = todayISO();
    var dm = msg.match(/on\s+(\d{1,2})\/(\d{1,2})\/(\d{2,4})/i);
    if (dm) {
      var day = parseInt(dm[1], 10), mon = parseInt(dm[2], 10), yr = parseInt(dm[3], 10);
      if (yr < 100) yr += 2000;
      if (day >= 1 && day <= 31 && mon >= 1 && mon <= 12) {
        dateISO = yr + '-' + pad(mon) + '-' + pad(day);
      }
    }

    // --- 5. transaction code ---
    var codeM = msg.match(/(?:^|\s)([A-Z0-9]{8,12})\s+Confirmed/i);
    var code = codeM ? codeM[1].toUpperCase() : '';

    // --- 6. category ---
    // Only look at the meaningful part of the message. The boilerplate tail
    // ("Transaction cost, Ksh0.00") would otherwise match the Fees rule on
    // every single message.
    var ctx = msg
      .split(/New M-?PESA balance/i)[0]
      .replace(/Transaction cost[^.]*\.?/gi, ' ')
      .replace(/Amount you can transact[^.]*\.?/gi, ' ');

    var cat;
    if (type === 'income') {
      // ZIIDI / MMF / SACCO money coming back is savings, not "income".
      cat = ruleCategory(merchant) || ruleCategory(ctx);
      if (!cat) {
        var cats = ledger().categories;
        var incomeCat = cats.filter(function (c) {
          return /income|sales|revenue/i.test(c.name);
        })[0];
        var otherCat = cats.filter(function (c) { return /^other$/i.test(c.name); })[0];
        cat = incomeCat ? incomeCat.name : (otherCat ? otherCat.name : (cats[0] ? cats[0].name : 'Other'));
      }
    } else {
      cat = guessCategory(merchant) ;
      if (!cat || /^other$/i.test(cat)) cat = guessCategory(ctx);
    }

    return {
      id: uid(),
      type: type,
      amount: amount,
      category: cat,
      merchant: merchant,
      date: dateISO,
      source: 'mpesa',
      code: code,
      raw: msg,
      selected: true,
      duplicate: false
    };
  }

  function isDuplicate(p) {
    if (!p.code) return false;
    return ledger().transactions.some(function (t) { return t.code && t.code === p.code; });
  }

  // ---------- render: summary ----------
  function renderSummary() {
    var t = totals();
    var incEl = $('#incomeInput');
    if (incEl && document.activeElement !== incEl) {
      incEl.value = t.declared > 0 ? t.declared : '';
    }
    $('#statBudget').textContent = fmt(t.budget);
    $('#statSpent').textContent = fmt(t.spent);
    $('#statLeft').textContent = fmt(t.left);
    $('#statLeft').classList.toggle('neg', t.left < 0);

    $('#statIncomeSub').textContent = t.declared > 0
      ? fmt(t.received) + ' received this month'
      : (t.received > 0 ? 'Tap to set expected income' : 'Tap to set income');

    var used = t.budget > 0 ? Math.round((t.spent / t.budget) * 100) : 0;
    $('#statBudgetSub').textContent = t.budget > 0 ? used + '% of budget used' : 'No budget set';

    $('#statSpentSub').textContent = t.budget > 0
      ? fmt(t.budgetLeft) + ' left in budget'
      : 'This month so far';

    $('#statLeftSub').textContent = t.left < 0 ? 'Over income' : 'Income minus spent';

    $('#monthLabel').textContent = monthLabel(state.month);
    $('#donutTotal').textContent = fmt(t.spent);
  }

  // ---------- render: overview ----------
  function renderOverview() {
    renderChart();
    renderInsights();
    renderRecent();
  }

  function renderChart() {
    var svg = $('#donut'), legend = $('#legend');
    svg.innerHTML = ''; legend.innerHTML = '';
    var byCat = spentByCategory();
    var l = ledger();
    var items = l.categories.map(function (c) {
      return { name: c.name, value: byCat[c.name] || 0, color: c.color };
    }).filter(function (i) { return i.value > 0; });

    var total = items.reduce(function (s, i) { return s + i.value; }, 0);
    var NS = 'http://www.w3.org/2000/svg';
    var cx = 100, cy = 100, r = 78, circ = 2 * Math.PI * r;

    var track = document.createElementNS(NS, 'circle');
    track.setAttribute('cx', cx); track.setAttribute('cy', cy); track.setAttribute('r', r);
    track.setAttribute('stroke', '#e9f0ee'); track.setAttribute('stroke-width', '22');
    svg.appendChild(track);

    if (total <= 0) {
      var li = document.createElement('li');
      li.className = 'empty';
      li.textContent = 'No spending recorded for this month yet.';
      legend.appendChild(li);
      return;
    }

    var offset = 0;
    items.forEach(function (item) {
      var frac = item.value / total;
      var dash = frac * circ;
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', cx); c.setAttribute('cy', cy); c.setAttribute('r', r);
      c.setAttribute('stroke', item.color); c.setAttribute('stroke-width', '22');
      c.setAttribute('stroke-dasharray', dash + ' ' + (circ - dash));
      c.setAttribute('stroke-dashoffset', -offset);
      svg.appendChild(c);
      offset += dash;

      var row = document.createElement('li');
      var dot = document.createElement('span'); dot.className = 'dot'; dot.style.background = item.color;
      var nm = document.createElement('span'); nm.className = 'lg-name'; nm.textContent = item.name;
      var val = document.createElement('span'); val.className = 'lg-val';
      val.textContent = fmt(item.value) + ' · ' + Math.round(frac * 100) + '%';
      row.appendChild(dot); row.appendChild(nm); row.appendChild(val);
      legend.appendChild(row);
    });
  }

  function renderInsights() {
    var ul = $('#insights'); ul.innerHTML = '';
    var t = totals();
    var byCat = spentByCategory();
    var items = [];

    if (t.budget > 0 && t.income > 0) {
      var used = Math.round((t.spent / t.budget) * 100);
      if (t.spent > t.budget) {
        items.push({ cls: 'bad', html: 'You are <b>' + fmt(t.spent - t.budget) + '</b> over your total budget this month.' });
      } else if (used >= 90) {
        items.push({ cls: 'warn', html: 'You have used <b>' + used + '%</b> of your budget — only <b>' + fmt(t.budgetLeft) + '</b> left.' });
      } else {
        items.push({ cls: 'good', html: 'You have used <b>' + used + '%</b> of your budget, leaving <b>' + fmt(t.budgetLeft) + '</b>.' });
      }
    }

    if (t.unallocated > 0) {
      items.push({ cls: 'warn', html: '<b>' + fmt(t.unallocated) + '</b> of your income is not assigned to any category.' });
    } else if (t.unallocated < 0) {
      items.push({ cls: 'bad', html: 'Your budgets exceed your income by <b>' + fmt(Math.abs(t.unallocated)) + '</b>.' });
    }

    var over = ledger().categories.filter(function (c) {
      return c.budget > 0 && (byCat[c.name] || 0) > c.budget;
    });
    if (over.length) {
      items.push({
        cls: 'bad',
        html: '<b>' + over.length + '</b> categor' + (over.length === 1 ? 'y is' : 'ies are') + ' over budget: ' +
          esc(over.map(function (c) { return c.name; }).join(', ')) + '.'
      });
    }

    var top = Object.keys(byCat).sort(function (a, b) { return byCat[b] - byCat[a]; })[0];
    if (top && t.spent > 0) {
      var share = Math.round((byCat[top] / t.spent) * 100);
      items.push({ cls: '', html: 'Biggest spend: <b>' + esc(top) + '</b> at <b>' + fmt(byCat[top]) + '</b> (' + share + '% of spending).' });
    }

    // pace
    var now = new Date();
    var inMonth = monthOf(todayISO()) === state.month;
    if (inMonth && t.budget > 0) {
      var days = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      var day = now.getDate();
      var expected = t.budget * (day / days);
      if (t.spent > expected * 1.15) {
        items.push({ cls: 'warn', html: 'You are spending faster than the month is passing. Day <b>' + day + '</b> of ' + days + '.' });
      } else if (t.spent < expected * 0.85) {
        items.push({ cls: 'good', html: 'You are pacing well — spending slower than the month is passing.' });
      }
    }

    // goals
    var goals = ledger().goals;
    if (goals.length) {
      var totalSaved = goals.reduce(function (s, g) { return s + g.saved; }, 0);
      var totalTarget = goals.reduce(function (s, g) { return s + g.target; }, 0);
      if (totalTarget > 0) {
        items.push({ cls: '', html: 'Savings goals: <b>' + fmt(totalSaved) + '</b> of <b>' + fmt(totalTarget) + '</b> (' + Math.round(totalSaved / totalTarget * 100) + '%).' });
      }
    }

    if (!items.length) items.push({ cls: '', html: 'Add income and categories to see insights.' });

    items.forEach(function (it) {
      var li = document.createElement('li');
      if (it.cls) li.className = it.cls;
      li.innerHTML = it.html;
      ul.appendChild(li);
    });
  }

  function txIcon(t) {
    if (t.type === 'income') return '↓';
    return '↑';
  }

  function renderRecent() {
    var ul = $('#recentTx'); ul.innerHTML = '';
    var txs = monthTx().slice().sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    }).slice(0, 5);

    if (!txs.length) {
      ul.innerHTML = '<li class="empty-state">No activity yet.</li>';
      return;
    }
    txs.forEach(function (t) {
      var li = document.createElement('li');
      var nm = document.createElement('span');
      nm.className = 'm-name';
      nm.textContent = t.merchant || t.category;
      var amt = document.createElement('span');
      amt.className = 'm-amt' + (t.type === 'income' ? ' income' : '');
      amt.textContent = (t.type === 'income' ? '+' : '−') + fmt(t.amount).replace('KSh ', '');
      li.appendChild(nm); li.appendChild(amt);
      ul.appendChild(li);
    });
  }

  // ---------- render: transactions ----------
  function renderTransactions() {
    var ul = $('#txList'); ul.innerHTML = '';
    var txs = monthTx().slice().sort(function (a, b) {
      return a.date < b.date ? 1 : a.date > b.date ? -1 : 0;
    });
    if (txFilter !== 'all') {
      txs = txs.filter(function (t) { return t.type === txFilter; });
    }

    if (!txs.length) {
      ul.innerHTML = '<li class="empty-state">No transactions for this filter.</li>';
      return;
    }

    txs.forEach(function (t) {
      var li = document.createElement('li');
      li.className = 'tx-item';

      var ico = document.createElement('div');
      ico.className = 'tx-ico' + (t.type === 'income' ? ' income' : '');
      ico.textContent = txIcon(t);

      var main = document.createElement('div');
      main.className = 'tx-main';
      var title = document.createElement('div');
      title.className = 'tx-title';
      title.textContent = t.merchant || t.category;
      var meta = document.createElement('div');
      meta.className = 'tx-meta';
      meta.textContent = shortDate(t.date) + ' · ' + t.category + (t.source === 'mpesa' ? ' · M-Pesa' : '');
      main.appendChild(title); main.appendChild(meta);

      var amt = document.createElement('div');
      amt.className = 'tx-amt ' + t.type;
      amt.textContent = (t.type === 'income' ? '+' : '−') + fmt(t.amount);

      var del = document.createElement('button');
      del.className = 'tx-del';
      del.type = 'button';
      del.innerHTML = '&times;';
      del.title = 'Delete';
      del.addEventListener('click', function () {
        ledger().transactions = ledger().transactions.filter(function (x) { return x.id !== t.id; });
        save(); renderAll();
      });

      li.appendChild(ico); li.appendChild(main); li.appendChild(amt); li.appendChild(del);
      ul.appendChild(li);
    });
  }

  function fillTxCategories() {
    var sel = $('#txCategory');
    var cur = sel.value;
    sel.innerHTML = '';
    ledger().categories.forEach(function (c) {
      var o = document.createElement('option');
      o.value = c.name; o.textContent = c.name;
      sel.appendChild(o);
    });
    if (cur && ledger().categories.some(function (c) { return c.name === cur; })) sel.value = cur;
  }

  // ---------- render: budget ----------
  function renderBudget() {
    var l = ledger();
    var byCat = spentByCategory();
    var list = $('#categoryList');
    list.innerHTML = '';

    l.categories.forEach(function (cat) {
      var spent = byCat[cat.name] || 0;
      var row = document.createElement('div');
      row.className = 'cat-row';

      var nameCell = document.createElement('div');
      nameCell.className = 'cat-name-cell';
      var nameInput = document.createElement('input');
      nameInput.className = 'cat-name';
      nameInput.type = 'text';
      nameInput.value = cat.name;
      nameInput.maxLength = 40;
      nameInput.setAttribute('aria-label', 'Category name');
      var oldName = cat.name;
      nameInput.addEventListener('input', function () {
        cat.name = nameInput.value;
        save();
      });
      nameInput.addEventListener('change', function () {
        // rename transactions that used the old name
        if (oldName !== cat.name) {
          l.transactions.forEach(function (t) { if (t.category === oldName) t.category = cat.name; });
          oldName = cat.name;
          save(); renderAll();
        }
      });

      var bar = document.createElement('div');
      bar.className = 'bar';
      var fill = document.createElement('span');
      var pct = cat.budget > 0 ? (spent / cat.budget) * 100 : (spent > 0 ? 100 : 0);
      fill.style.width = Math.min(pct, 100) + '%';
      if (spent > cat.budget && cat.budget > 0) { fill.classList.add('over'); row.classList.add('over'); }
      else if (pct >= 80) fill.classList.add('warn');
      bar.appendChild(fill);

      nameCell.appendChild(nameInput);
      nameCell.appendChild(bar);

      var budgetCell = document.createElement('div');
      budgetCell.className = 'cat-input-wrap cat-budget-cell';
      budgetCell.innerHTML = '<span class="cur">KSh</span>';
      var budgetInput = document.createElement('input');
      budgetInput.className = 'cat-input';
      budgetInput.type = 'number';
      budgetInput.min = '0'; budgetInput.step = '0.01'; budgetInput.inputMode = 'decimal';
      budgetInput.value = cat.budget;
      budgetInput.setAttribute('aria-label', 'Budget for ' + cat.name);
      budgetInput.addEventListener('input', function () {
        cat.budget = num(budgetInput.value);
        save(); renderSummary(); renderInsights();
      });
      budgetCell.appendChild(budgetInput);

      var spentCell = document.createElement('div');
      spentCell.className = 'cat-spent-cell cat-spent-static' + (spent > cat.budget && cat.budget > 0 ? ' over' : '');
      spentCell.textContent = fmt(spent);

      var del = document.createElement('button');
      del.className = 'cat-del';
      del.type = 'button';
      del.innerHTML = '&times;';
      del.title = 'Delete category';
      del.addEventListener('click', function () {
        if (!confirm('Delete "' + cat.name + '"? Transactions in this category will stay but become uncategorised.')) return;
        l.categories = l.categories.filter(function (c) { return c.id !== cat.id; });
        save(); renderAll();
      });

      row.appendChild(nameCell); row.appendChild(budgetCell); row.appendChild(spentCell); row.appendChild(del);
      list.appendChild(row);
    });

    $('#catCount').textContent = l.categories.length + (l.categories.length === 1 ? ' category' : ' categories');
    $('#incomeInput').value = l.income || '';
    var t = totals();
    $('#incomeNote').textContent = t.received > 0
      ? 'Recorded income this month: ' + fmt(t.received)
      : 'No income transactions recorded this month yet.';
  }

  // ---------- render: goals ----------
  function renderGoals() {
    var grid = $('#goalGrid');
    grid.innerHTML = '';
    var goals = ledger().goals;

    if (!goals.length) {
      grid.innerHTML = '<div class="empty-state">No goals yet. Create one below to start saving towards something.</div>';
    }

    goals.forEach(function (g) {
      var pct = g.target > 0 ? Math.min((g.saved / g.target) * 100, 100) : 0;
      var card = document.createElement('div');
      card.className = 'goal-card';

      var top = document.createElement('div');
      top.className = 'goal-top';
      var left = document.createElement('div');
      var nm = document.createElement('div'); nm.className = 'goal-name'; nm.textContent = g.name;
      var dt = document.createElement('div'); dt.className = 'goal-date';
      dt.textContent = g.date ? 'Target: ' + shortDate(g.date) : 'No deadline';
      left.appendChild(nm); left.appendChild(dt);
      var del = document.createElement('button');
      del.className = 'goal-del'; del.innerHTML = '&times;'; del.title = 'Delete goal';
      del.addEventListener('click', function () {
        if (!confirm('Delete goal "' + g.name + '"?')) return;
        ledger().goals = ledger().goals.filter(function (x) { return x.id !== g.id; });
        save(); renderAll();
      });
      top.appendChild(left); top.appendChild(del);

      var figs = document.createElement('div');
      figs.className = 'goal-figures';
      var saved = document.createElement('span'); saved.className = 'goal-saved'; saved.textContent = fmt(g.saved);
      var target = document.createElement('span'); target.className = 'goal-target'; target.textContent = 'of ' + fmt(g.target);
      figs.appendChild(saved); figs.appendChild(target);

      var bar = document.createElement('div'); bar.className = 'goal-bar';
      var fill = document.createElement('span'); fill.style.width = pct + '%';
      bar.appendChild(fill);

      var pctEl = document.createElement('div');
      pctEl.className = 'goal-pct';
      pctEl.textContent = Math.round(pct) + '% funded' + (pct >= 100 ? ' — goal reached! 🎉' : '');

      var add = document.createElement('div');
      add.className = 'goal-add';
      var inp = document.createElement('input');
      inp.type = 'number'; inp.min = '0'; inp.step = '0.01'; inp.inputMode = 'decimal';
      inp.placeholder = 'Add amount';
      var btn = document.createElement('button');
      btn.type = 'button'; btn.textContent = 'Add';
      btn.addEventListener('click', function () {
        var v = num(inp.value);
        if (v <= 0) { inp.focus(); return; }
        g.saved += v;
        save(); renderAll();
      });
      add.appendChild(inp); add.appendChild(btn);

      card.appendChild(top);
      card.appendChild(figs);
      card.appendChild(bar);
      card.appendChild(pctEl);
      card.appendChild(add);
      grid.appendChild(card);
    });

    $('#goalCount').textContent = goals.length + (goals.length === 1 ? ' goal' : ' goals');
  }

  // ---------- render: import preview ----------
  function renderPreview() {
    var wrap = $('#previewWrap');
    var list = $('#previewList');
    list.innerHTML = '';

    if (!preview.length) { wrap.hidden = true; return; }
    wrap.hidden = false;
    $('#previewCount').textContent = preview.length;

    preview.forEach(function (p, idx) {
      var row = document.createElement('div');
      row.className = 'pv-row' + (p.duplicate ? ' dup' : '');

      var chk = document.createElement('input');
      chk.type = 'checkbox';
      chk.checked = p.selected && !p.duplicate;
      chk.disabled = p.duplicate;
      chk.addEventListener('change', function () { p.selected = chk.checked; });

      var main = document.createElement('div');
      main.className = 'pv-main';
      var nm = document.createElement('div');
      nm.className = 'pv-name';
      nm.textContent = p.merchant;
      var meta = document.createElement('div');
      meta.className = 'pv-meta';
      meta.textContent = shortDate(p.date) + (p.code ? ' · ' + p.code : '') + (p.duplicate ? ' · already imported' : '');
      main.appendChild(nm); main.appendChild(meta);

      var amt = document.createElement('div');
      amt.className = 'pv-amt' + (p.type === 'income' ? ' income' : '');
      amt.textContent = (p.type === 'income' ? '+' : '−') + fmt(p.amount);

      var sel = document.createElement('select');
      ledger().categories.forEach(function (c) {
        var o = document.createElement('option');
        o.value = c.name; o.textContent = c.name;
        if (c.name === p.category) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener('change', function () { p.category = sel.value; });

      var del = document.createElement('button');
      del.className = 'tx-del pv-del';
      del.innerHTML = '&times;';
      del.title = 'Remove';
      del.addEventListener('click', function () {
        preview.splice(idx, 1);
        renderPreview();
      });

      row.appendChild(chk); row.appendChild(main); row.appendChild(amt); row.appendChild(sel); row.appendChild(del);
      list.appendChild(row);
    });
  }

  // ---------- full render ----------
  function renderAll() {
    $('#monthInput').value = state.month;
    $$('.seg-btn').forEach(function (b) {
      var on = b.dataset.ledger === state.active;
      b.classList.toggle('active', on);
      b.setAttribute('aria-selected', on ? 'true' : 'false');
    });
    $('#ledgerHint').textContent = state.active === 'personal' ? 'Household budget' : 'Business budget';

    renderSummary();
    renderOverview();
    fillTxCategories();
    renderTransactions();
    renderBudget();
    renderGoals();
    renderPreview();
  }

  // ---------- events ----------
  function bind() {
    // ledger switch
    $$('.seg-btn').forEach(function (b) {
      b.addEventListener('click', function () {
        state.active = b.dataset.ledger;
        save();
        preview = [];
        renderAll();
      });
    });

    // month
    $('#monthInput').addEventListener('change', function () {
      var v = $('#monthInput').value;
      if (/^\d{4}-\d{2}$/.test(v)) { state.month = v; save(); renderAll(); }
    });

    // tabs
    $$('.tab').forEach(function (t) {
      t.addEventListener('click', function () {
        $$('.tab').forEach(function (x) { x.classList.remove('active'); });
        t.classList.add('active');
        $$('.tab-panel').forEach(function (p) { p.classList.remove('active'); });
        var panel = $('#tab-' + t.dataset.tab);
        if (panel) panel.classList.add('active');
        if (t.dataset.tab === 'transactions') fillTxCategories();
      });
    });

    $$('[data-goto]').forEach(function (b) {
      b.addEventListener('click', function () {
        var target = b.dataset.goto;
        var tab = document.querySelector('.tab[data-tab="' + target + '"]');
        if (tab) tab.click();
      });
    });

    // tx filters
    $$('#txFilterChips .chip').forEach(function (c) {
      c.addEventListener('click', function () {
        $$('#txFilterChips .chip').forEach(function (x) { x.classList.remove('active'); });
        c.classList.add('active');
        txFilter = c.dataset.filter;
        renderTransactions();
      });
    });

    // add transaction
    $('#txDate').value = todayISO();
    $('#txForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var amount = num($('#txAmount').value);
      if (amount <= 0) { $('#txAmount').focus(); return; }
      var t = {
        id: uid(),
        type: $('#txType').value === 'income' ? 'income' : 'expense',
        amount: amount,
        category: $('#txCategory').value || 'Other',
        merchant: $('#txMerchant').value.trim(),
        date: $('#txDate').value || todayISO(),
        source: 'manual',
        code: ''
      };
      ledger().transactions.push(t);
      save();
      $('#txAmount').value = '';
      $('#txMerchant').value = '';
      renderAll();
    });

    // income
    $('#incomeInput').addEventListener('input', function () {
      ledger().income = num($('#incomeInput').value);
      save(); renderSummary(); renderInsights(); renderBudget();
    });

    // add category
    $('#addCatForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#newCatName').value.trim();
      if (!name) { $('#newCatName').focus(); return; }
      ledger().categories.push({
        id: uid(), name: name, budget: num($('#newCatBudget').value),
        color: PALETTE[ledger().categories.length % PALETTE.length]
      });
      save();
      $('#newCatName').value = ''; $('#newCatBudget').value = '';
      renderAll();
    });

    // add goal
    $('#goalForm').addEventListener('submit', function (e) {
      e.preventDefault();
      var name = $('#goalName').value.trim();
      if (!name) { $('#goalName').focus(); return; }
      ledger().goals.push({
        id: uid(), name: name, target: num($('#goalTarget').value),
        saved: 0, date: $('#goalDate').value || ''
      });
      save();
      $('#goalName').value = ''; $('#goalTarget').value = ''; $('#goalDate').value = '';
      renderAll();
    });

    // import
    $('#parseBtn').addEventListener('click', function () {
      var text = $('#smsInput').value;
      var msgs = splitMessages(text);
      var parsed = [];
      msgs.forEach(function (m) {
        var p = parseMessage(m);
        if (p) {
          p.duplicate = isDuplicate(p);
          p.selected = !p.duplicate;
          parsed.push(p);
        }
      });
      preview = parsed;
      renderPreview();
      if (!parsed.length) {
        alert('No M-Pesa transactions found. Make sure the message includes an amount like "Ksh1,250.00".');
      }
    });

    $('#clearSmsBtn').addEventListener('click', function () {
      $('#smsInput').value = '';
      preview = [];
      renderPreview();
    });

    $('#importBtn').addEventListener('click', function () {
      var count = 0;
      preview.forEach(function (p) {
        if (!p.selected || p.duplicate) return;
        ledger().transactions.push({
          id: uid(), type: p.type, amount: p.amount, category: p.category,
          merchant: p.merchant, date: p.date, source: 'mpesa', code: p.code
        });
        count++;
      });
      save();
      preview = [];
      $('#smsInput').value = '';
      renderAll();
      if (count > 0) {
        alert('Imported ' + count + ' transaction' + (count === 1 ? '' : 's') + ' into ' + state.active + '.');
      } else {
        alert('Nothing selected to import.');
      }
    });

    // floating add button -> open transactions and focus amount
    var fab = $('#fab');
    if (fab) {
      fab.addEventListener('click', function () {
        var tab = document.querySelector('.tab[data-tab="transactions"]');
        if (tab) tab.click();
        var amt = $('#txAmount');
        if (amt) { amt.focus(); amt.scrollIntoView({ block: 'center', behavior: 'smooth' }); }
      });
    }

    // reset
    $('#resetBtn').addEventListener('click', function () {
      if (!confirm('Reset ALL data (personal + business) back to the sample budget? This cannot be undone.')) return;
      state = defaultState();
      save();
      preview = [];
      renderAll();
    });
  }

  // ---------- init ----------
  function init() {
    bind();
    renderAll();
    // register service worker for installable PWA
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', function () {
        navigator.serviceWorker.register('sw.js').catch(function () {});
      });
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

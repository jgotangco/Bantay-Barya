/**
 * Bantay Barya - Theme Engine, PIN Security, Device Detection & Hero Analytics
 */
(function (window) {
  'use strict';

  const {
    THEME_PALETTES,
    INSPIRATION_ITEMS,
    HERO_SLIDES,
    STORAGE_KEY_THEME,
    LEGACY_KEY_THEME_V6,
    STORAGE_KEY_PIN,
    LEGACY_KEY_PIN_V6,
    CURRENCIES,
    getRelativeDateString
  } = window.BB_DATA;

  const state = window.BB_STATE;

  let heroExpenseChart = null;
  let heroAomChart = null;
  let heroCashFlowChart = null;
  let heroAssetsLiabilitiesChart = null;
  let deferredInstallPrompt = null;
  let enteredPinBuffer = '';
  let inspirationInterval = null;

  const CAROUSEL_CYCLE_TOTAL_SECONDS = 20;
  let heroCountdownRemaining = CAROUSEL_CYCLE_TOTAL_SECONDS;
  let heroCountdownInterval = null;

  function getCurrentSeasonByDate() {
    const month = new Date().getMonth();
    if (month >= 2 && month <= 4) return 'sakura';
    if (month >= 5 && month <= 7) return 'sunflower';
    if (month >= 8 && month <= 10) return 'pumpkin';
    return 'snow';
  }

  function normalizeThemeName(name) {
    const map = { winter: 'snow', spring: 'sakura', summer: 'sunflower', fall: 'pumpkin' };
    return map[name] || name;
  }

  function getActiveThemePalette() {
    const active = state.effectiveTheme || 'default';
    return THEME_PALETTES[active] || THEME_PALETTES.default;
  }

  function applyTheme(themeMode) {
    const root = document.documentElement;
    let effective = normalizeThemeName(themeMode);

    if (themeMode === 'auto_date') {
      effective = getCurrentSeasonByDate();
    }

    state.effectiveTheme = effective;

    if (effective === 'system') {
      root.removeAttribute('data-theme');
    } else {
      root.setAttribute('data-theme', effective);
    }

    const themeIcons = {
      deep_teal: '💎', auto_date: '🗓️', sunflower: '🌻', snow: '❄️', sakura: '🌸', pumpkin: '🎃',
      winter: '❄️', spring: '🌸', summer: '🌻', fall: '🎃', light: '☀️', dark: '🌙', system: '🌓'
    };

    const iconEl = document.getElementById('settingsThemeIcon');
    if (iconEl) {
      iconEl.textContent = themeIcons[themeMode] || '💎';
    }

    renderAllHeroCharts();
    if (window.BB_REPORTS?.updateChartThemeColors) {
      window.BB_REPORTS.updateChartThemeColors();
    }
  }

  function initThemeEngine() {
    let savedTheme = localStorage.getItem(STORAGE_KEY_THEME) || localStorage.getItem(LEGACY_KEY_THEME_V6) || 'deep_teal';
    savedTheme = normalizeThemeName(savedTheme);
    state.theme = savedTheme;
    const themeSelect = document.getElementById('settingsThemeSelect');
    if (themeSelect) themeSelect.value = savedTheme;
    applyTheme(savedTheme);

    if (themeSelect) {
      themeSelect.addEventListener('change', (e) => {
        const selected = e.target.value;
        state.theme = selected;
        localStorage.setItem(STORAGE_KEY_THEME, selected);
        applyTheme(selected);
        if (window.BB_WALLETS?.syncActiveSlotPayload) window.BB_WALLETS.syncActiveSlotPayload();
        if (window.BB_CORE?.saveData) window.BB_CORE.saveData();

        const cleanThemeLabels = {
          deep_teal: 'Deep Teal / Fintech 💎', sunflower: 'Sunflower 🌻', snow: 'Snow ❄️', sakura: 'Sakura 🌸', pumpkin: 'Pumpkin 🎃',
          light: 'Light ☀️', dark: 'Dark 🌙', auto_date: 'Auto (Date) 🗓️', system: 'System 🌓'
        };
        if (window.BB_CORE?.showToast) {
          window.BB_CORE.showToast(`Theme updated to ${cleanThemeLabels[selected] || selected}`, 'info');
        }
      });
    }

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    mediaQuery.addEventListener('change', () => {
      if (state.theme === 'system') {
        applyTheme('system');
        renderAllHeroCharts();
        if (document.getElementById('reportModal')?.classList.contains('active') && window.BB_REPORTS?.renderExpenseReport) {
          window.BB_REPORTS.renderExpenseReport();
        }
      }
    });
  }

  function updateTimeGreeting() {
    const hour = new Date().getHours();
    let greetingWord = 'Good day';
    let icon = '☀️';

    if (hour >= 5 && hour < 12) {
      greetingWord = 'Good morning';
      icon = '🌅';
    } else if (hour >= 12 && hour < 17) {
      greetingWord = 'Good afternoon';
      icon = '☀️';
    } else if (hour >= 17 && hour < 22) {
      greetingWord = 'Good evening';
      icon = '🌆';
    } else {
      greetingWord = 'Good night';
      icon = '🌙';
    }

    const name = (state.settings.userName || '').trim();
    const greetingText = name ? `${greetingWord}, ${name}!` : `${greetingWord}!`;

    const textEl = document.getElementById('greetingTimeText');
    const iconEl = document.getElementById('greetingTimeIcon');
    if (textEl) textEl.textContent = greetingText;
    if (iconEl) iconEl.textContent = icon;
  }

  function displayInspirationItem(item) {
    const card = document.getElementById('inspirationCard');
    if (!card) return;

    card.classList.add('fade-out');

    setTimeout(() => {
      const tagEl = document.getElementById('quoteTypeTag');
      if (tagEl) {
        tagEl.textContent = item.tag;
        tagEl.className = item.type === 'tip' ? 'inspiration-type-tag tag-tip' : 'inspiration-type-tag';
      }

      const quoteEl = document.getElementById('financeQuoteText');
      if (quoteEl) {
        quoteEl.textContent = item.type === 'quote' ? `"${item.text}"` : item.text;
      }

      const authorEl = document.getElementById('financeQuoteAuthor');
      if (authorEl) {
        authorEl.textContent = item.type === 'quote' ? `— ${item.author}` : `Tip • ${item.author}`;
      }

      card.classList.remove('fade-out');
    }, 250);
  }

  function cycleInspiration(manual = false) {
    state.currentInspirationIndex = (state.currentInspirationIndex + 1) % INSPIRATION_ITEMS.length;
    displayInspirationItem(INSPIRATION_ITEMS[state.currentInspirationIndex]);
    if (manual && window.BB_CORE?.showToast) {
      window.BB_CORE.showToast('Loaded next insight!', 'info');
    }
  }

  function setupGreetingQuoteListeners() {
    updateTimeGreeting();
    displayInspirationItem(INSPIRATION_ITEMS[state.currentInspirationIndex]);

    const refreshBtn = document.getElementById('refreshQuoteBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => cycleInspiration(true));
    }

    if (inspirationInterval) clearInterval(inspirationInterval);
    inspirationInterval = setInterval(() => {
      cycleInspiration(false);
      updateTimeGreeting();
    }, 60000);
  }

  function updateCountdownUI() {
    const cd = document.getElementById('carouselCountdown');
    if (cd) cd.textContent = `${heroCountdownRemaining}s`;
  }

  function startHeroCarouselTimer() {
    if (heroCountdownInterval) clearInterval(heroCountdownInterval);
    heroCountdownRemaining = CAROUSEL_CYCLE_TOTAL_SECONDS;
    updateCountdownUI();

    heroCountdownInterval = setInterval(() => {
      heroCountdownRemaining--;
      if (heroCountdownRemaining <= 0) {
        const nextSlide = (state.currentHeroSlide + 1) % HERO_SLIDES.length;
        setHeroSlide(nextSlide);
        heroCountdownRemaining = CAROUSEL_CYCLE_TOTAL_SECONDS;
      }
      updateCountdownUI();
    }, 1000);
  }

  function setupHeroCarouselListeners() {
    const wrapper = document.getElementById('carouselDotsWrapper');
    const dots = wrapper ? wrapper.querySelectorAll('.carousel-dot') : [];
    dots.forEach(dot => {
      dot.addEventListener('click', () => {
        const slideIdx = parseInt(dot.getAttribute('data-slide'), 10) || 0;
        setHeroSlide(slideIdx);
        startHeroCarouselTimer();
      });
    });

    const prevBtn = document.getElementById('carouselPrevBtn');
    if (prevBtn) {
      prevBtn.addEventListener('click', () => {
        const prev = (state.currentHeroSlide - 1 + HERO_SLIDES.length) % HERO_SLIDES.length;
        setHeroSlide(prev);
        startHeroCarouselTimer();
      });
    }

    const nextBtn = document.getElementById('carouselNextBtn');
    if (nextBtn) {
      nextBtn.addEventListener('click', () => {
        const next = (state.currentHeroSlide + 1) % HERO_SLIDES.length;
        setHeroSlide(next);
        startHeroCarouselTimer();
      });
    }

    startHeroCarouselTimer();
  }

  function setHeroSlide(slideIndex) {
    state.currentHeroSlide = slideIndex;
    const info = HERO_SLIDES[slideIndex] || HERO_SLIDES[0];

    const icon = document.getElementById('carouselSlideIcon');
    const title = document.getElementById('carouselSlideTitle');
    const sub = document.getElementById('carouselSlideSubtitle');
    if (icon) icon.textContent = info.icon;
    if (title) title.textContent = info.title;
    if (sub) sub.textContent = info.subtitle;

    const slides = [
      document.getElementById('heroSlide0'),
      document.getElementById('heroSlide1'),
      document.getElementById('heroSlide2'),
      document.getElementById('heroSlide3')
    ];
    slides.forEach((s, idx) => {
      if (s) {
        if (idx === slideIndex) s.classList.add('active');
        else s.classList.remove('active');
      }
    });

    const dots = document.getElementById('carouselDotsWrapper')?.querySelectorAll('.carousel-dot') || [];
    dots.forEach((dot, idx) => {
      if (idx === slideIndex) dot.classList.add('active');
      else dot.classList.remove('active');
    });

    setTimeout(() => {
      if (slideIndex === 0) renderHeroExpensePieChart();
      if (slideIndex === 1) renderHeroSpendingBufferLineChart();
      if (slideIndex === 2) renderHeroCashFlowBarChart();
      if (slideIndex === 3) renderHeroAssetsLiabilitiesChart();
    }, 50);
  }

  function renderAllHeroCharts() {
    renderHeroExpensePieChart();
    renderHeroSpendingBufferLineChart();
    renderHeroCashFlowBarChart();
    renderHeroAssetsLiabilitiesChart();
  }

  function renderHeroExpensePieChart() {
    const canvas = document.getElementById('heroExpensePieChart');
    const empty = document.getElementById('heroExpenseEmpty');
    if (!canvas) return;

    if (heroExpenseChart) {
      heroExpenseChart.destroy();
      heroExpenseChart = null;
    }

    const now = new Date();
    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const txList = state.transactions;

    const monthExpenses = txList.filter(tx => {
      if ((parseFloat(tx.debit) || 0) <= 0 || tx.isTransfer || tx.type === 'transfer_out' || tx.isArchived) return false;
      if (!tx.date) return false;
      const d = new Date(tx.date);
      return d.getFullYear() === currentYear && d.getMonth() === currentMonth;
    });

    const categoryMap = {};
    let totalDebit = 0;

    monthExpenses.forEach(tx => {
      const cat = (tx.item || 'Unclassified').trim();
      const val = parseFloat(tx.debit) || 0;
      categoryMap[cat] = (categoryMap[cat] || 0) + val;
      totalDebit += val;
    });

    const categories = Object.keys(categoryMap);

    if (categories.length === 0 || totalDebit === 0) {
      canvas.style.display = 'none';
      if (empty) empty.style.display = 'flex';
      return;
    }

    canvas.style.display = 'block';
    if (empty) empty.style.display = 'none';

    const sortedCats = categories
      .map(c => ({ name: c, amount: categoryMap[c] }))
      .sort((a, b) => b.amount - a.amount);

    const labels = sortedCats.map(c => c.name);
    const data = sortedCats.map(c => c.amount);
    const palette = getActiveThemePalette();
    const bgColors = labels.map((_, i) => palette[i % palette.length]);

    const activeTheme = document.documentElement.getAttribute('data-theme');
    const isDark = activeTheme !== 'light' && activeTheme !== 'sakura' && activeTheme !== 'sunflower';
    const textColor = isDark ? '#f8fafc' : '#0f172a';
    const baseSymbol = CURRENCIES[state.settings.baseCurrency]?.symbol || '₱';

    const ctx = canvas.getContext('2d');
    heroExpenseChart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: bgColors,
          borderColor: isDark ? '#111827' : '#ffffff',
          borderWidth: 2,
          hoverOffset: 4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '58%',
        plugins: {
          legend: {
            position: 'right',
            labels: {
              color: textColor,
              font: { family: 'Plus Jakarta Sans', size: 10, weight: '500' },
              boxWidth: 10,
              padding: 6,
              usePointStyle: true,
              pointStyle: 'circle'
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const val = context.raw || 0;
                const pct = ((val / totalDebit) * 100).toFixed(1);
                return ` ${context.label}: ${baseSymbol}${val.toLocaleString('en-US', { minimumFractionDigits: 2 })} (${pct}%)`;
              }
            }
          }
        }
      }
    });
  }

  function renderHeroSpendingBufferLineChart() {
    const canvas = document.getElementById('heroAomLineChart');
    const empty = document.getElementById('heroAomEmpty');
    if (!canvas) return;

    if (heroAomChart) {
      heroAomChart.destroy();
      heroAomChart = null;
    }

    const txList = state.transactions;
    const sortedChronological = [...txList].sort((a, b) => {
      if (a.date === b.date) return (a.createdAt || 0) - (b.createdAt || 0);
      return a.date.localeCompare(b.date);
    });

    const initialBal = state.wallets.reduce((acc, w) => acc + (parseFloat(w.initialBalance) || 0), 0);

    if (sortedChronological.length === 0 && initialBal === 0) {
      canvas.style.display = 'none';
      if (empty) empty.style.display = 'flex';
      return;
    }

    canvas.style.display = 'block';
    if (empty) empty.style.display = 'none';

    const labels = [];
    const bufferValues = [];
    let defaultInitDate;
    if (sortedChronological.length > 0 && sortedChronological[0].date) {
      const firstTxDate = new Date(sortedChronological[0].date + 'T00:00:00');
      defaultInitDate = new Date(firstTxDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    } else {
      defaultInitDate = new Date(new Date().getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    const inflowQueue = [];
    if (initialBal > 0) {
      inflowQueue.push({ date: defaultInitDate, remaining: initialBal });
    }

    let lastDebitDate = null;
    let lastInflowBatchDate = null;

    sortedChronological.forEach((tx, idx) => {
      if (tx.isArchived) return;
      if (tx.isTransfer || tx.type === 'transfer_out' || tx.type === 'transfer_in') return;

      const credit = parseFloat(tx.credit) || 0;
      const debit = parseFloat(tx.debit) || 0;
      const txDateObj = new Date(tx.date + 'T00:00:00');

      if (credit > 0) {
        inflowQueue.push({ date: txDateObj, remaining: credit });
      }

      if (debit > 0) {
        let needed = debit;
        lastDebitDate = txDateObj;

        while (needed > 0 && inflowQueue.length > 0) {
          const currentBatch = inflowQueue[0];
          lastInflowBatchDate = currentBatch.date;

          if (currentBatch.remaining <= needed) {
            needed -= currentBatch.remaining;
            inflowQueue.shift();
          } else {
            currentBatch.remaining -= needed;
            needed = 0;
          }
        }
      }

      let currentPointBuffer = 0;
      if (lastDebitDate && lastInflowBatchDate) {
        const diff = lastDebitDate.getTime() - lastInflowBatchDate.getTime();
        currentPointBuffer = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
      } else if (inflowQueue.length > 0) {
        const diff = txDateObj.getTime() - inflowQueue[0].date.getTime();
        currentPointBuffer = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
      }

      const shortDate = tx.date ? tx.date.slice(5) : `#${idx + 1}`;
      labels.push(shortDate);
      bufferValues.push(currentPointBuffer);
    });

    const maxPoints = 10;
    const finalLabels = labels.slice(-maxPoints);
    const finalValues = bufferValues.slice(-maxPoints);

    if (finalValues.length === 0) {
      finalLabels.push('Today');
      finalValues.push(window.BB_WALLETS ? window.BB_WALLETS.calculateSpendingBuffer('all').days : 0);
    }

    const activeTheme = document.documentElement.getAttribute('data-theme');
    const isLight = activeTheme === 'light' || activeTheme === 'sakura' || activeTheme === 'sunflower';
    const textColor = isLight ? '#0a3640' : '#b8d4cc';
    const gridColor = isLight ? 'rgba(10,54,64,0.06)' : 'rgba(123, 227, 168, 0.12)';
    const target30Data = finalValues.map(() => 30);

    const ctx = canvas.getContext('2d');
    heroAomChart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: finalLabels,
        datasets: [
          {
            label: 'Spending Buffer (Days)',
            data: finalValues,
            borderColor: '#7be3a8',
            backgroundColor: 'rgba(123, 227, 168, 0.18)',
            borderWidth: 2.5,
            tension: 0.35,
            fill: true,
            pointBackgroundColor: '#7be3a8',
            pointRadius: 3.5,
            pointHoverRadius: 5.5
          },
          {
            label: '30-Day Healthy Target',
            data: target30Data,
            borderColor: '#38bdf8',
            borderWidth: 1.5,
            borderDash: [5, 5],
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: textColor,
              font: { family: 'Plus Jakarta Sans', size: 10, weight: '500' },
              boxWidth: 10,
              padding: 6,
              usePointStyle: true,
              pointStyle: 'line'
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => ` ${context.dataset.label}: ${context.raw} Days`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 9 } }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { family: 'JetBrains Mono', size: 9 },
              callback: (v) => `${v}d`
            },
            suggestedMin: 0,
            suggestedMax: 40
          }
        }
      }
    });
  }

  function renderHeroCashFlowBarChart() {
    const canvas = document.getElementById('heroCashFlowBarChart');
    const empty = document.getElementById('heroCashFlowEmpty');
    if (!canvas) return;

    if (heroCashFlowChart) {
      heroCashFlowChart.destroy();
      heroCashFlowChart = null;
    }

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const now = new Date();
    const months = [];

    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({
        year: d.getFullYear(),
        month: d.getMonth(),
        label: `${monthNames[d.getMonth()]} ${d.getFullYear().toString().slice(-2)}`,
        inflow: 0,
        outflow: 0
      });
    }

    let hasActivity = false;
    const txList = state.transactions;

    txList.forEach(tx => {
      if (!tx.date || tx.isArchived || tx.isTransfer || tx.type === 'transfer_out' || tx.type === 'transfer_in') return;
      const txDate = new Date(tx.date);
      const y = txDate.getFullYear();
      const m = txDate.getMonth();

      const matchedMonth = months.find(item => item.year === y && item.month === m);
      if (matchedMonth) {
        const credit = parseFloat(tx.credit) || 0;
        const debit = parseFloat(tx.debit) || 0;
        if (credit > 0 || debit > 0) {
          matchedMonth.inflow += credit;
          matchedMonth.outflow += debit;
          hasActivity = true;
        }
      }
    });

    if (!hasActivity) {
      canvas.style.display = 'none';
      if (empty) empty.style.display = 'flex';
      return;
    }

    canvas.style.display = 'block';
    if (empty) empty.style.display = 'none';

    const labels = months.map(m => m.label);
    const inflowData = months.map(m => m.inflow);
    const outflowData = months.map(m => m.outflow);

    const activeTheme = document.documentElement.getAttribute('data-theme');
    const isLight = activeTheme === 'light' || activeTheme === 'sakura' || activeTheme === 'sunflower';
    const textColor = isLight ? '#0a3640' : '#b8d4cc';
    const gridColor = isLight ? 'rgba(10,54,64,0.06)' : 'rgba(123, 227, 168, 0.12)';
    const baseSymbol = CURRENCIES[state.settings.baseCurrency]?.symbol || '₱';

    const ctx = canvas.getContext('2d');
    heroCashFlowChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Inflows (+)',
            data: inflowData,
            backgroundColor: '#7be3a8',
            borderRadius: 4,
            borderSkipped: false
          },
          {
            label: 'Outflows (-)',
            data: outflowData,
            backgroundColor: '#ff7b92',
            borderRadius: 4,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: textColor,
              font: { family: 'Plus Jakarta Sans', size: 10, weight: '500' },
              boxWidth: 10,
              padding: 6,
              usePointStyle: true,
              pointStyle: 'rectRounded'
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const val = context.raw || 0;
                return ` ${context.dataset.label}: ${baseSymbol}${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 9, weight: '600' } }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { family: 'JetBrains Mono', size: 9 },
              callback: (v) => baseSymbol + v.toLocaleString()
            }
          }
        }
      }
    });
  }

  function renderHeroAssetsLiabilitiesChart() {
    const canvas = document.getElementById('heroAssetsLiabilitiesChart');
    const empty = document.getElementById('heroAssetsLiabilitiesEmpty');
    if (!canvas) return;

    if (heroAssetsLiabilitiesChart) {
      heroAssetsLiabilitiesChart.destroy();
      heroAssetsLiabilitiesChart = null;
    }

    const now = new Date();
    const months = [];
    const baseCurr = state.settings.baseCurrency || 'PHP';
    const baseSymbol = CURRENCIES[baseCurr]?.symbol || '₱';

    for (let i = 2; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth();
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      let endDateStr;
      if (i === 0) {
        endDateStr = now.toISOString().split('T')[0];
      } else {
        const lastDay = new Date(year, month + 1, 0).getDate();
        endDateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`;
      }

      let monthAssets = 0;
      let monthLiabilities = 0;

      state.wallets.forEach(w => {
        let bal = parseFloat(w.initialBalance) || 0;
        state.transactions
          .filter(t => t.walletId === w.id && t.date <= endDateStr)
          .forEach(t => {
            bal += (parseFloat(t.credit) || 0) - (parseFloat(t.debit) || 0);
          });

        const walletCurr = w.currency || baseCurr;
        const converted = window.BB_WALLETS ? window.BB_WALLETS.convertCurrency(bal, walletCurr, baseCurr) : bal;

        if (converted >= 0) monthAssets += converted;
        else monthLiabilities += Math.abs(converted);
      });

      state.debts.forEach(debt => {
        const debtBal = parseFloat(debt.balance) || 0;
        if (debtBal > 0) monthLiabilities += debtBal;
      });

      const netWorth = monthAssets - monthLiabilities;

      months.push({
        label: label,
        assets: Math.round(monthAssets * 100) / 100,
        liabilities: Math.round(monthLiabilities * 100) / 100,
        netWorth: Math.round(netWorth * 100) / 100
      });
    }

    const hasAnyData = months.some(m => m.assets > 0 || m.liabilities > 0 || state.transactions.length > 0 || state.debts.length > 0);

    if (!hasAnyData) {
      canvas.style.display = 'none';
      if (empty) empty.style.display = 'flex';
      return;
    }

    canvas.style.display = 'block';
    if (empty) empty.style.display = 'none';

    const labels = months.map(m => m.label);
    const assetsData = months.map(m => m.assets);
    const liabilitiesData = months.map(m => m.liabilities);
    const netWorthData = months.map(m => m.netWorth);

    const activeTheme = document.documentElement.getAttribute('data-theme');
    const isLight = activeTheme === 'light' || activeTheme === 'sakura' || activeTheme === 'sunflower';
    const textColor = isLight ? '#0a3640' : '#b8d4cc';
    const gridColor = isLight ? 'rgba(10,54,64,0.06)' : 'rgba(123, 227, 168, 0.12)';

    const ctx = canvas.getContext('2d');
    heroAssetsLiabilitiesChart = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'Total Assets (A)',
            data: assetsData,
            backgroundColor: '#7be3a8',
            borderRadius: 4,
            borderSkipped: false
          },
          {
            label: 'Total Liabilities (L)',
            data: liabilitiesData,
            backgroundColor: '#ff7b92',
            borderRadius: 4,
            borderSkipped: false
          },
          {
            label: 'Real Net Worth (E)',
            data: netWorthData,
            backgroundColor: '#38bdf8',
            borderRadius: 4,
            borderSkipped: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: {
              color: textColor,
              font: { family: 'Plus Jakarta Sans', size: 9, weight: '500' },
              boxWidth: 9,
              padding: 5,
              usePointStyle: true,
              pointStyle: 'rectRounded'
            }
          },
          tooltip: {
            callbacks: {
              label: (context) => {
                const val = context.raw || 0;
                return ` ${context.dataset.label}: ${baseSymbol}${val.toLocaleString('en-US', { minimumFractionDigits: 2 })}`;
              }
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            ticks: { color: textColor, font: { family: 'Plus Jakarta Sans', size: 9, weight: '600' } }
          },
          y: {
            grid: { color: gridColor },
            ticks: {
              color: textColor,
              font: { family: 'JetBrains Mono', size: 9 },
              callback: (v) => baseSymbol + v.toLocaleString()
            }
          }
        }
      }
    });
  }

  function initPinSecurity() {
    const storedPin = localStorage.getItem(STORAGE_KEY_PIN) || localStorage.getItem(LEGACY_KEY_PIN_V6);
    updatePinSettingsUI();

    const pinModal = document.getElementById('pinLockModal');
    const pinHiddenInput = document.getElementById('pinHiddenInput');
    const pinError = document.getElementById('pinErrorMessage');
    const pinClear = document.getElementById('pinClearKey');
    const pinBack = document.getElementById('pinBackspaceKey');

    if (storedPin && storedPin.length === 7 && pinModal) {
      pinModal.style.display = 'flex';
      enteredPinBuffer = '';
      updatePinDotsUI();
      if (pinHiddenInput) setTimeout(() => pinHiddenInput.focus(), 200);
    } else if (pinModal) {
      pinModal.style.display = 'none';
    }

    const pinKeys = document.querySelectorAll('.pin-key[data-key]');
    pinKeys.forEach(k => {
      k.addEventListener('click', () => {
        if (enteredPinBuffer.length < 7) {
          enteredPinBuffer += k.getAttribute('data-key');
          updatePinDotsUI();
          checkEnteredPin();
        }
      });
    });

    if (pinClear) {
      pinClear.addEventListener('click', () => {
        enteredPinBuffer = '';
        updatePinDotsUI();
        if (pinError) pinError.style.display = 'none';
      });
    }

    if (pinBack) {
      pinBack.addEventListener('click', () => {
        if (enteredPinBuffer.length > 0) {
          enteredPinBuffer = enteredPinBuffer.slice(0, -1);
          updatePinDotsUI();
          if (pinError) pinError.style.display = 'none';
        }
      });
    }

    if (pinHiddenInput) {
      pinHiddenInput.addEventListener('input', (e) => {
        enteredPinBuffer = e.target.value.replace(/\D/g, '').slice(0, 7);
        updatePinDotsUI();
        checkEnteredPin();
      });
    }

    const pinForm = document.getElementById('settingsPinForm');
    if (pinForm) {
      pinForm.addEventListener('submit', (e) => {
        e.preventDefault();
        const p1 = document.getElementById('settingsNewPin')?.value.trim();
        const p2 = document.getElementById('settingsConfirmPin')?.value.trim();

        if (!/^\d{7}$/.test(p1)) {
          if (window.BB_CORE?.showToast) window.BB_CORE.showToast('PIN must be exactly 7 numeric digits.', 'error');
          return;
        }

        if (p1 !== p2) {
          if (window.BB_CORE?.showToast) window.BB_CORE.showToast('PIN confirmation does not match.', 'error');
          return;
        }

        localStorage.setItem(STORAGE_KEY_PIN, p1);
        updatePinSettingsUI();
        document.getElementById('settingsNewPin').value = '';
        document.getElementById('settingsConfirmPin').value = '';
        if (window.BB_CORE?.showToast) window.BB_CORE.showToast('7-digit PIN protection enabled! App is now secured.', 'success');
      });
    }

    const removePinBtn = document.getElementById('settingsRemovePinBtn');
    if (removePinBtn) {
      removePinBtn.addEventListener('click', () => {
        if (confirm('Disable PIN protection and remove your 7-digit PIN?')) {
          localStorage.removeItem(STORAGE_KEY_PIN);
          localStorage.removeItem(LEGACY_KEY_PIN_V6);
          updatePinSettingsUI();
          if (window.BB_CORE?.showToast) window.BB_CORE.showToast('PIN protection disabled.', 'info');
        }
      });
    }
  }

  function updatePinDotsUI() {
    const dots = document.querySelectorAll('.pin-dot');
    dots.forEach((dot, idx) => {
      if (idx < enteredPinBuffer.length) dot.classList.add('filled');
      else dot.classList.remove('filled');
    });
  }

  function checkEnteredPin() {
    if (enteredPinBuffer.length === 7) {
      const storedPin = localStorage.getItem(STORAGE_KEY_PIN) || localStorage.getItem(LEGACY_KEY_PIN_V6);
      const pinModal = document.getElementById('pinLockModal');
      const pinError = document.getElementById('pinErrorMessage');
      const pinDisplay = document.getElementById('pinDisplayWrapper');
      const pinHiddenInput = document.getElementById('pinHiddenInput');

      if (enteredPinBuffer === storedPin) {
        if (pinError) pinError.style.display = 'none';
        if (pinModal) {
          pinModal.style.opacity = '0';
          pinModal.style.transition = 'opacity 0.25s ease';
          setTimeout(() => {
            pinModal.style.display = 'none';
            pinModal.style.opacity = '1';
          }, 250);
        }
        if (window.BB_CORE?.showToast) window.BB_CORE.showToast('Unlocked Bantay Barya!', 'success');
      } else {
        if (pinError) pinError.style.display = 'block';
        if (pinDisplay) {
          pinDisplay.classList.add('shake');
          setTimeout(() => {
            pinDisplay.classList.remove('shake');
            enteredPinBuffer = '';
            if (pinHiddenInput) pinHiddenInput.value = '';
            updatePinDotsUI();
          }, 450);
        }
      }
    }
  }

  function updatePinSettingsUI() {
    const storedPin = localStorage.getItem(STORAGE_KEY_PIN) || localStorage.getItem(LEGACY_KEY_PIN_V6);
    const badge = document.getElementById('settingsPinStatusBadge');
    const removeBtn = document.getElementById('settingsRemovePinBtn');
    const saveBtn = document.getElementById('settingsSavePinBtn');

    if (storedPin && storedPin.length === 7) {
      if (badge) {
        badge.textContent = 'PIN Active (7 Digits)';
        badge.className = 'kpi-badge badge-positive';
      }
      if (removeBtn) removeBtn.style.display = 'inline-flex';
      if (saveBtn) saveBtn.textContent = 'Change 7-Digit PIN';
    } else {
      if (badge) {
        badge.textContent = 'No PIN Set';
        badge.className = 'kpi-badge';
      }
      if (removeBtn) removeBtn.style.display = 'none';
      if (saveBtn) saveBtn.textContent = 'Set 7-Digit PIN';
    }
  }

  function detectDeviceType() {
    const ua = navigator.userAgent || '';
    const isTouch = ('ontouchstart' in window) || (navigator.maxTouchPoints > 0);
    const width = window.innerWidth || document.documentElement.clientWidth || document.body.clientWidth;

    let formFactor = 'desktop';
    let deviceName = 'Desktop PC';
    let deviceEmoji = '💻';
    let osType = 'desktop';

    const isIos = /iPad|iPhone|iPod/.test(ua) || (navigator.platform === 'MacIntel' && isTouch && width <= 1024);
    const isAndroid = /Android/.test(ua);

    if (isIos) {
      osType = 'ios';
      if (/iPad/.test(ua) || (width >= 768 && width <= 1024)) {
        formFactor = 'tablet';
        deviceName = 'iPad Tablet';
        deviceEmoji = '📟';
      } else {
        formFactor = 'mobile';
        deviceName = 'iPhone';
        deviceEmoji = '📱';
      }
    } else if (isAndroid) {
      osType = 'android';
      if (/Mobile/.test(ua) || width < 768) {
        formFactor = 'mobile';
        deviceName = 'Android Phone';
        deviceEmoji = '📱';
      } else {
        formFactor = 'tablet';
        deviceName = 'Android Tablet';
        deviceEmoji = '📟';
      }
    } else if (width < 768) {
      formFactor = 'mobile';
      deviceName = 'Mobile Browser';
      deviceEmoji = '📱';
    } else if (width <= 1024 && isTouch) {
      formFactor = 'tablet';
      deviceName = 'Tablet Browser';
      deviceEmoji = '📟';
    } else if (/Macintosh|Mac OS X/.test(ua)) {
      deviceName = 'Mac';
      deviceEmoji = '💻';
    } else if (/Windows/.test(ua)) {
      deviceName = 'Windows PC';
      deviceEmoji = '💻';
    }

    state.detectedPlatform = formFactor;
    document.documentElement.setAttribute('data-device', formFactor);
    document.documentElement.setAttribute('data-os', osType);
    document.documentElement.setAttribute('data-touch', isTouch ? 'true' : 'false');

    const icon = document.getElementById('deviceIcon');
    const text = document.getElementById('deviceText');
    if (icon) icon.textContent = deviceEmoji;
    if (text) text.textContent = deviceName;

    const iosSec = document.getElementById('iosGuideSection');
    const androidSec = document.getElementById('androidGuideSection');
    const desktopSec = document.getElementById('desktopGuideSection');
    const sub = document.getElementById('installGuideSubtitle');

    if (iosSec && androidSec && desktopSec) {
      if (osType === 'ios') {
        iosSec.style.order = '-1';
        if (sub) sub.textContent = 'Add Bantay Barya to your Home Screen in 2 taps';
      } else if (osType === 'android') {
        androidSec.style.order = '-1';
        if (sub) sub.textContent = 'Install Bantay Barya to your Android device';
      } else {
        desktopSec.style.order = '-1';
        if (sub) sub.textContent = 'Install Bantay Barya desktop app shortcut';
      }
    }
  }

  function initPwaAndShortcuts() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then((reg) => console.log('Bantay Barya Service Worker registered:', reg.scope))
          .catch((err) => console.warn('Service Worker registration skipped:', err));
      });
    }

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredInstallPrompt = e;
      const sec = document.getElementById('nativeInstallPromptSection');
      if (sec) sec.style.display = 'block';
    });

    const triggerBtn = document.getElementById('triggerNativeInstallBtn');
    if (triggerBtn) {
      triggerBtn.addEventListener('click', async () => {
        if (deferredInstallPrompt) {
          deferredInstallPrompt.prompt();
          const { outcome } = await deferredInstallPrompt.userChoice;
          if (outcome === 'accepted' && window.BB_CORE?.showToast) {
            window.BB_CORE.showToast('Bantay Barya shortcut installed!', 'success');
          }
          deferredInstallPrompt = null;
          const sec = document.getElementById('nativeInstallPromptSection');
          if (sec) sec.style.display = 'none';
          document.getElementById('installModal')?.classList.remove('active');
        }
      });
    }

    const closeInstall = () => document.getElementById('installModal')?.classList.remove('active');
    document.getElementById('closeInstallModalBtn')?.addEventListener('click', closeInstall);
    document.getElementById('closeInstallModalFooterBtn')?.addEventListener('click', closeInstall);
    document.getElementById('installModal')?.addEventListener('click', (e) => {
      if (e.target === document.getElementById('installModal')) closeInstall();
    });
  }

  window.BB_THEME = {
    initThemeEngine,
    applyTheme,
    getActiveThemePalette,
    updateTimeGreeting,
    setupGreetingQuoteListeners,
    setupHeroCarouselListeners,
    renderAllHeroCharts,
    initPinSecurity,
    updatePinSettingsUI,
    detectDeviceType,
    initPwaAndShortcuts
  };
})(window);

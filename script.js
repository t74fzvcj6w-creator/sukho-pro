(() => {
  const won = (n) => `${Math.round(n).toLocaleString('ko-KR')}원`;

  /* ---------- Theme toggle ---------- */
  const themeToggle = document.getElementById('theme-toggle');
  const themeIcon = document.getElementById('theme-icon');
  const applyTheme = (theme) => {
    if (theme) {
      document.documentElement.setAttribute('data-theme', theme);
      themeIcon.textContent = theme === 'dark' ? '☀️' : '🌙';
    } else {
      document.documentElement.removeAttribute('data-theme');
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      themeIcon.textContent = prefersDark ? '☀️' : '🌙';
    }
  };
  const savedTheme = localStorage.getItem('easycost-theme');
  applyTheme(savedTheme);
  themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const currentlyDark = current ? current === 'dark' : prefersDark;
    const next = currentlyDark ? 'light' : 'dark';
    localStorage.setItem('easycost-theme', next);
    applyTheme(next);
  });

  /* ---------- Ingredient rows ---------- */
  const rowsContainer = document.getElementById('ingredient-rows');
  const rowTemplate = document.getElementById('ingredient-row-template');
  const addIngredientBtn = document.getElementById('add-ingredient');

  const rowSubtotal = (row) => {
    const price = parseFloat(row.querySelector('.ing-price').value) || 0;
    const buyQty = parseFloat(row.querySelector('.ing-buy-qty').value) || 0;
    const useQty = parseFloat(row.querySelector('.ing-use-qty').value) || 0;
    const unitCost = buyQty > 0 ? price / buyQty : 0;
    return unitCost * useQty;
  };

  const refreshRowSubtotal = (row) => {
    row.querySelector('.ing-subtotal').textContent = won(rowSubtotal(row));
  };

  const addIngredientRow = () => {
    const frag = rowTemplate.content.cloneNode(true);
    const row = frag.querySelector('.ingredient-row');
    row.querySelectorAll('input').forEach((input) => {
      input.addEventListener('input', () => refreshRowSubtotal(row));
    });
    row.querySelector('.row-remove').addEventListener('click', () => {
      row.remove();
    });
    rowsContainer.appendChild(row);
  };

  addIngredientBtn.addEventListener('click', addIngredientRow);
  addIngredientRow();
  addIngredientRow();

  /* ---------- Calculation ---------- */
  const form = document.getElementById('calc-form');
  const resultsSection = document.getElementById('results');
  const statTotalCost = document.getElementById('stat-total-cost');
  const statPrice = document.getElementById('stat-price');
  const statCostRatio = document.getElementById('stat-cost-ratio');
  const stackedBar = document.getElementById('stacked-bar');
  const legend = document.getElementById('legend');
  const saveMenuBtn = document.getElementById('save-menu');

  let lastResult = null;

  const seriesInfo = [
    { key: 'ingredients', label: '재료비', varName: '--series-1' },
    { key: 'labor', label: '인건비', varName: '--series-2' },
    { key: 'overhead', label: '기타비용', varName: '--series-3' },
  ];

  const renderBreakdown = (parts, total) => {
    stackedBar.innerHTML = '';
    legend.innerHTML = '';

    seriesInfo.forEach(({ key, label, varName }) => {
      const value = parts[key];
      if (value <= 0) return;
      const pct = total > 0 ? (value / total) * 100 : 0;

      const seg = document.createElement('div');
      seg.className = 'bar-seg';
      seg.style.width = `${pct}%`;
      seg.style.background = `var(${varName})`;
      seg.textContent = pct >= 12 ? `${pct.toFixed(0)}%` : '';
      stackedBar.appendChild(seg);

      const li = document.createElement('li');
      const swatch = document.createElement('span');
      swatch.className = 'swatch';
      swatch.style.background = `var(${varName})`;
      const text = document.createElement('span');
      text.textContent = `${label} `;
      const val = document.createElement('span');
      val.className = 'legend-value';
      val.textContent = `${won(value)} (${pct.toFixed(0)}%)`;
      li.append(swatch, text, val);
      legend.appendChild(li);
    });
    stackedBar.setAttribute('aria-label',
      seriesInfo.map(({ key, label }) => `${label} ${won(parts[key])}`).join(', '));
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();

    const dishName = document.getElementById('dish-name').value.trim() || '이름 없는 메뉴';
    const rows = Array.from(rowsContainer.querySelectorAll('.ingredient-row'));
    const ingredientsTotal = rows.reduce((sum, row) => sum + rowSubtotal(row), 0);
    const laborCost = parseFloat(document.getElementById('labor-cost').value) || 0;
    const overheadCost = parseFloat(document.getElementById('overhead-cost').value) || 0;
    const marginRate = Math.min(parseFloat(document.getElementById('margin-rate').value) || 0, 99);

    const totalCost = ingredientsTotal + laborCost + overheadCost;
    const price = marginRate < 100 ? totalCost / (1 - marginRate / 100) : totalCost;
    const costRatio = price > 0 ? (totalCost / price) * 100 : 0;
    const profit = price - totalCost;

    lastResult = { dishName, ingredientsTotal, laborCost, overheadCost, totalCost, price, costRatio, profit };

    statTotalCost.textContent = won(totalCost);
    statPrice.textContent = won(price);
    statCostRatio.textContent = `${costRatio.toFixed(1)}%`;

    renderBreakdown({ ingredients: ingredientsTotal, labor: laborCost, overhead: overheadCost }, totalCost);

    resultsSection.hidden = false;
    resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  /* ---------- Saved menus (localStorage) ---------- */
  const savedSection = document.getElementById('saved-section');
  const savedTableBody = document.getElementById('saved-table-body');
  const STORAGE_KEY = 'easycost-menus';

  const loadSaved = () => {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
    } catch {
      return [];
    }
  };
  const persistSaved = (menus) => localStorage.setItem(STORAGE_KEY, JSON.stringify(menus));

  const renderSaved = () => {
    const menus = loadSaved();
    savedSection.hidden = menus.length === 0;
    savedTableBody.innerHTML = '';
    menus.forEach((menu, idx) => {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${menu.dishName}</td>
        <td>${won(menu.totalCost)}</td>
        <td>${won(menu.price)}</td>
        <td>${menu.costRatio.toFixed(1)}%</td>
        <td>${won(menu.profit)}</td>
        <td><button type="button" class="saved-row-remove" aria-label="삭제">✕</button></td>
      `;
      tr.querySelector('.saved-row-remove').addEventListener('click', () => {
        const current = loadSaved();
        current.splice(idx, 1);
        persistSaved(current);
        renderSaved();
      });
      savedTableBody.appendChild(tr);
    });
  };

  saveMenuBtn.addEventListener('click', () => {
    if (!lastResult) return;
    const menus = loadSaved();
    menus.push(lastResult);
    persistSaved(menus);
    renderSaved();
    savedSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  renderSaved();
})();

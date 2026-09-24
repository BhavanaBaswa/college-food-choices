/**
 * app.js
 * College Food Choices Analytics - Core Application Controller
 * Handles SPA routing, dynamic data rendering, Data Explorer (filtering/sorting/pagination),
 * Tableau interactive dashboard visualisations (Chart.js), Data Dictionary search, and print workflows.
 */

(function () {
  'use strict';

  // State Management
  const state = {
    currentRoute: 'home',
    data: window.COLLEGE_FOOD_DATA || [],
    eda: window.EDA_SUMMARY || {},
    dictionary: window.DATA_DICTIONARY || [],
    explorer: {
      filtered: [],
      currentPage: 1,
      rowsPerPage: 15,
      sortField: 'Student_ID',
      sortAsc: true,
      filters: {
        search: '',
        gender: '',
        year: '',
        residence: '',
        dietCategory: '',
        academicPerf: ''
      }
    },
    activeDashboardTab: 'dash-executive',
    charts: {}
  };

  // DOM Elements
  const dom = {
    navLinks: document.querySelectorAll('.nav-link'),
    pageViews: document.querySelectorAll('.page-view'),
    menuToggle: document.querySelector('.menu-toggle'),
    navMenu: document.querySelector('.nav-menu'),
    modalBackdrop: document.getElementById('recordModal'),
    modalBody: document.getElementById('modalDetailsBody'),
    modalClose: document.getElementById('modalCloseBtn'),
    explorerTableBody: document.getElementById('explorerTableBody'),
    explorerCount: document.getElementById('explorerCount'),
    pageIndicator: document.getElementById('pageIndicator'),
    prevPageBtn: document.getElementById('prevPageBtn'),
    nextPageBtn: document.getElementById('nextPageBtn'),
    rowsPerPageSelect: document.getElementById('rowsPerPageSelect'),
    searchInput: document.getElementById('searchStudents'),
    filterGender: document.getElementById('filterGender'),
    filterYear: document.getElementById('filterYear'),
    filterResidence: document.getElementById('filterResidence'),
    filterDietCategory: document.getElementById('filterDietCategory'),
    filterAcademic: document.getElementById('filterAcademic'),
    resetFiltersBtn: document.getElementById('resetFiltersBtn'),
    exportCsvBtn: document.getElementById('exportCsvBtn'),
    dictTableBody: document.getElementById('dictTableBody'),
    dictSearch: document.getElementById('dictSearch'),
    dictTypeFilter: document.getElementById('dictTypeFilter'),
    insightsContainer: document.getElementById('insightsContainer'),
    insightFilterBtns: document.querySelectorAll('.insight-filter-btn'),
    dashTabs: document.querySelectorAll('.dash-tab-btn'),
    dashPanels: document.querySelectorAll('.dashboard-panel'),
    printReportBtn: document.getElementById('printReportBtn')
  };

  // --- ROUTING ---
  function navigateTo(route) {
    if (!route) route = 'home';
    state.currentRoute = route;

    // Update active page view
    dom.pageViews.forEach(view => {
      if (view.id === 'view-' + route) {
        view.classList.add('active');
      } else {
        view.classList.remove('active');
      }
    });

    // Update active nav link
    dom.navLinks.forEach(link => {
      const linkRoute = link.getAttribute('data-route');
      if (linkRoute === route) {
        link.classList.add('active');
      } else {
        link.classList.remove('active');
      }
    });

    // Close mobile menu if open
    if (dom.navMenu.classList.contains('open')) {
      dom.navMenu.classList.remove('open');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Trigger route-specific initializations
    if (route === 'tableau') {
      setTimeout(renderCurrentDashboardCharts, 100);
    } else if (route === 'explorer') {
      applyExplorerFilters();
    } else if (route === 'home') {
      setTimeout(renderHomeCharts, 100);
    }
  }

  function setupRouting() {
    window.addEventListener('hashchange', () => {
      const hash = window.location.hash.replace('#', '');
      navigateTo(hash || 'home');
    });

    document.querySelectorAll('[data-route]').forEach(el => {
      el.addEventListener('click', (e) => {
        const route = el.getAttribute('data-route');
        if (route) {
          window.location.hash = route;
        }
      });
    });

    if (dom.menuToggle) {
      dom.menuToggle.addEventListener('click', () => {
        dom.navMenu.classList.toggle('open');
      });
    }

    // Default initial route
    const initialHash = window.location.hash.replace('#', '');
    navigateTo(initialHash || 'home');
  }

  // --- DATA EXPLORER ---
  function applyExplorerFilters() {
    const f = state.explorer.filters;
    state.explorer.filtered = state.data.filter(item => {
      const matchesSearch = !f.search || (
        item.Student_ID.toLowerCase().includes(f.search) ||
        item.Major.toLowerCase().includes(f.search) ||
        item.Dietary_Preference.toLowerCase().includes(f.search)
      );
      const matchesGender = !f.gender || item.Gender === f.gender;
      const matchesYear = !f.year || item.Year_of_Study === f.year;
      const matchesResidence = !f.residence || item.Residence_Type === f.residence;
      const matchesDietCategory = !f.dietCategory || item.Dietary_Score_Category === f.dietCategory;
      const matchesAcademic = !f.academicPerf || item.Academic_Performance === f.academicPerf;

      return matchesSearch && matchesGender && matchesYear && matchesResidence && matchesDietCategory && matchesAcademic;
    });

    // Sort
    sortFilteredData();

    // Reset to page 1
    state.explorer.currentPage = 1;
    renderExplorerTable();
  }

  function sortFilteredData() {
    const field = state.explorer.sortField;
    const asc = state.explorer.sortAsc ? 1 : -1;

    state.explorer.filtered.sort((a, b) => {
      let va = a[field];
      let vb = b[field];

      if (typeof va === 'string') {
        return va.localeCompare(vb) * asc;
      }
      return ((va || 0) - (vb || 0)) * asc;
    });
  }

  function renderExplorerTable() {
    if (!dom.explorerTableBody) return;
    const total = state.explorer.filtered.length;
    const startIdx = (state.explorer.currentPage - 1) * state.explorer.rowsPerPage;
    const pageRows = state.explorer.filtered.slice(startIdx, startIdx + state.explorer.rowsPerPage);

    // Update count
    dom.explorerCount.textContent = `Showing ${Math.min(startIdx + 1, total)} - ${Math.min(startIdx + pageRows.length, total)} of ${total} students`;

    // Render table rows
    if (pageRows.length === 0) {
      dom.explorerTableBody.innerHTML = `<tr><td colspan="10" style="text-align: center; padding: 2.5rem; color: var(--text-muted);">No student records matched the specified filters.</td></tr>`;
      dom.pageIndicator.textContent = 'Page 0 of 0';
      dom.prevPageBtn.disabled = true;
      dom.nextPageBtn.disabled = true;
      return;
    }

    let html = '';
    pageRows.forEach(row => {
      const dietBadgeClass = row.Dietary_Score_Category === 'Higher Dietary Score' ? 'badge-success' :
                             row.Dietary_Score_Category === 'Moderate Dietary Score' ? 'badge-warning' : 'badge-danger';
      const acadBadgeClass = row.Academic_Performance === 'Excellent' ? 'badge-primary' :
                             row.Academic_Performance === 'Good' ? 'badge-success' :
                             row.Academic_Performance === 'Average' ? 'badge-warning' : 'badge-danger';

      html += `
        <tr>
          <td><strong>${row.Student_ID}</strong></td>
          <td>${row.Age} / ${row.Gender}</td>
          <td>${row.Year_of_Study}</td>
          <td>${row.Major}</td>
          <td>${row.Residence_Type}</td>
          <td><strong>${row.GPA.toFixed(2)}</strong> <span class="badge ${acadBadgeClass}" style="margin-left:4px;">${row.Academic_Performance}</span></td>
          <td><strong>${row.Dietary_Health_Score}</strong> <span class="badge ${dietBadgeClass}" style="margin-left:4px;">${row.Dietary_Score_Category.replace(' Dietary Score', '')}</span></td>
          <td>${row.Breakfast_Frequency} d/wk</td>
          <td>${row.Fast_Food_Frequency} d/wk</td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="window.viewStudentDetails('${row.Student_ID}')">
              Details
            </button>
          </td>
        </tr>
      `;
    });

    dom.explorerTableBody.innerHTML = html;

    // Pagination controls
    const totalPages = Math.ceil(total / state.explorer.rowsPerPage) || 1;
    dom.pageIndicator.textContent = `Page ${state.explorer.currentPage} of ${totalPages}`;
    dom.prevPageBtn.disabled = state.explorer.currentPage <= 1;
    dom.nextPageBtn.disabled = state.explorer.currentPage >= totalPages;
  }

  window.viewStudentDetails = function (studentId) {
    const student = state.data.find(s => s.Student_ID === studentId);
    if (!student) return;

    let html = `
      <div style="margin-bottom: 1.5rem; border-bottom: 1px solid var(--border-light); padding-bottom: 1rem;">
        <h2 style="font-size: 1.4rem; color: var(--text-main);">${student.Student_ID} Profile Overview</h2>
        <p style="color: var(--text-muted); font-size: 0.9rem;">${student.Year_of_Study} • ${student.Major} • ${student.Gender}, ${student.Age} yrs</p>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem;">
        <div style="background: #f8fafc; padding: 1rem; border-radius: 8px;">
          <h4 style="font-size: 0.85rem; color: var(--primary); text-transform: uppercase; margin-bottom: 0.5rem;">Academic Performance</h4>
          <p><strong>GPA:</strong> ${student.GPA.toFixed(2)} (${student.Academic_Performance})</p>
          <p><strong>Attendance:</strong> ${student.Attendance_Percentage}%</p>
          <p><strong>Weekly Study Hours:</strong> ${student.Study_Hours} hrs/wk</p>
        </div>
        <div style="background: #f8fafc; padding: 1rem; border-radius: 8px;">
          <h4 style="font-size: 0.85rem; color: var(--success); text-transform: uppercase; margin-bottom: 0.5rem;">Dietary Health Index</h4>
          <p><strong>Score:</strong> ${student.Dietary_Health_Score} / 100 (${student.Dietary_Score_Category})</p>
          <p><strong>Preference:</strong> ${student.Dietary_Preference}</p>
          <p><strong>Meal Regularity:</strong> ${student.Meal_Regularity}</p>
        </div>
      </div>

      <h4 style="font-size: 0.95rem; margin-bottom: 0.75rem;">Behavioral Metrics & Environment</h4>
      <table style="width: 100%; font-size: 0.88rem; border-collapse: collapse;">
        <tr><td style="padding: 6px 0; color: var(--text-muted);">Breakfast Frequency:</td><td><strong>${student.Breakfast_Frequency} days / week</strong></td></tr>
        <tr><td style="padding: 6px 0; color: var(--text-muted);">Fast Food Frequency:</td><td><strong>${student.Fast_Food_Frequency} days / week</strong></td></tr>
        <tr><td style="padding: 6px 0; color: var(--text-muted);">Fruit / Vegetable Intake:</td><td><strong>${student.Fruit_Consumption} fruit / ${student.Vegetable_Consumption} veg servings daily</strong></td></tr>
        <tr><td style="padding: 6px 0; color: var(--text-muted);">Daily Water Intake:</td><td><strong>${student.Water_Intake} Liters / day</strong></td></tr>
        <tr><td style="padding: 6px 0; color: var(--text-muted);">Soft Drink Consumption:</td><td><strong>${student.Soft_Drink_Frequency} cans / week</strong></td></tr>
        <tr><td style="padding: 6px 0; color: var(--text-muted);">Nightly Sleep:</td><td><strong>${student.Sleep_Hours} hrs / night (${student.Sleep_Category})</strong></td></tr>
        <tr><td style="padding: 6px 0; color: var(--text-muted);">Physical Activity:</td><td><strong>${student.Physical_Activity_Hours} hrs / week</strong></td></tr>
        <tr><td style="padding: 6px 0; color: var(--text-muted);">Housing / Food Access:</td><td><strong>${student.Residence_Type} (${student.Food_Access})</strong></td></tr>
        <tr><td style="padding: 6px 0; color: var(--text-muted);">Cooking Frequency:</td><td><strong>${student.Cooking_Frequency} meals / week</strong></td></tr>
        <tr><td style="padding: 6px 0; color: var(--text-muted);">Monthly Food Budget:</td><td><strong>$${student.Monthly_Food_Budget.toFixed(2)} (Spent: $${student.Food_Expense.toFixed(2)} - ${student.Food_Budget_Utilization}% util)</strong></td></tr>
        <tr><td style="padding: 6px 0; color: var(--text-muted);">Stress Level:</td><td><strong>${student.Stress_Level}</strong></td></tr>
      </table>
    `;

    dom.modalBody.innerHTML = html;
    dom.modalBackdrop.classList.add('active');
  };

  function setupExplorerEvents() {
    if (!dom.searchInput) return;

    dom.searchInput.addEventListener('input', (e) => {
      state.explorer.filters.search = e.target.value.toLowerCase().trim();
      applyExplorerFilters();
    });

    dom.filterGender.addEventListener('change', (e) => {
      state.explorer.filters.gender = e.target.value;
      applyExplorerFilters();
    });

    dom.filterYear.addEventListener('change', (e) => {
      state.explorer.filters.year = e.target.value;
      applyExplorerFilters();
    });

    dom.filterResidence.addEventListener('change', (e) => {
      state.explorer.filters.residence = e.target.value;
      applyExplorerFilters();
    });

    dom.filterDietCategory.addEventListener('change', (e) => {
      state.explorer.filters.dietCategory = e.target.value;
      applyExplorerFilters();
    });

    dom.filterAcademic.addEventListener('change', (e) => {
      state.explorer.filters.academicPerf = e.target.value;
      applyExplorerFilters();
    });

    dom.resetFiltersBtn.addEventListener('click', () => {
      dom.searchInput.value = '';
      dom.filterGender.value = '';
      dom.filterYear.value = '';
      dom.filterResidence.value = '';
      dom.filterDietCategory.value = '';
      dom.filterAcademic.value = '';
      state.explorer.filters = { search: '', gender: '', year: '', residence: '', dietCategory: '', academicPerf: '' };
      applyExplorerFilters();
    });

    dom.prevPageBtn.addEventListener('click', () => {
      if (state.explorer.currentPage > 1) {
        state.explorer.currentPage--;
        renderExplorerTable();
      }
    });

    dom.nextPageBtn.addEventListener('click', () => {
      const totalPages = Math.ceil(state.explorer.filtered.length / state.explorer.rowsPerPage);
      if (state.explorer.currentPage < totalPages) {
        state.explorer.currentPage++;
        renderExplorerTable();
      }
    });

    dom.rowsPerPageSelect.addEventListener('change', (e) => {
      state.explorer.rowsPerPage = parseInt(e.target.value, 10);
      state.explorer.currentPage = 1;
      renderExplorerTable();
    });

    // Modal close
    dom.modalClose.addEventListener('click', () => {
      dom.modalBackdrop.classList.remove('active');
    });

    dom.modalBackdrop.addEventListener('click', (e) => {
      if (e.target === dom.modalBackdrop) {
        dom.modalBackdrop.classList.remove('active');
      }
    });

    // CSV Export
    dom.exportCsvBtn.addEventListener('click', () => {
      if (state.explorer.filtered.length === 0) return;
      const headers = Object.keys(state.explorer.filtered[0]);
      let csvContent = "data:text/csv;charset=utf-8," + headers.join(",") + "\n";
      state.explorer.filtered.forEach(row => {
        const line = headers.map(h => {
          let val = row[h];
          if (typeof val === 'string' && val.includes(',')) {
            return `"${val}"`;
          }
          return val;
        }).join(",");
        csvContent += line + "\n";
      });
      const encodedUri = encodeURI(csvContent);
      const link = document.createElement("a");
      link.setAttribute("href", encodedUri);
      link.setAttribute("download", "college_food_choices_filtered.csv");
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });

    // Column Sorting
    document.querySelectorAll('.data-table th[data-sort]').forEach(th => {
      th.style.cursor = 'pointer';
      th.addEventListener('click', () => {
        const sortField = th.getAttribute('data-sort');
        if (state.explorer.sortField === sortField) {
          state.explorer.sortAsc = !state.explorer.sortAsc;
        } else {
          state.explorer.sortField = sortField;
          state.explorer.sortAsc = true;
        }
        sortFilteredData();
        renderExplorerTable();
      });
    });
  }

  // --- DATA DICTIONARY ---
  function renderDataDictionary() {
    if (!dom.dictTableBody) return;
    const searchTerm = (dom.dictSearch ? dom.dictSearch.value : '').toLowerCase().trim();
    const typeFilter = dom.dictTypeFilter ? dom.dictTypeFilter.value : '';

    const filtered = state.dictionary.filter(item => {
      const matchSearch = !searchTerm || (
        item.field_name.toLowerCase().includes(searchTerm) ||
        item.description.toLowerCase().includes(searchTerm)
      );
      const matchType = !typeFilter || item.variable_type.includes(typeFilter);
      return matchSearch && matchType;
    });

    let html = '';
    filtered.forEach(item => {
      html += `
        <tr>
          <td><code style="font-weight:700; color:var(--primary);">${item.field_name}</code></td>
          <td>${item.description}</td>
          <td><span class="badge badge-secondary">${item.data_type}</span></td>
          <td>${item.variable_type}</td>
          <td>${item.measurement_unit}</td>
          <td><span style="font-size:0.8rem; color:var(--text-muted);">${item.allowed_values}</span></td>
          <td><code>${item.example_value}</code></td>
        </tr>
      `;
    });

    dom.dictTableBody.innerHTML = html || `<tr><td colspan="7" style="text-align:center; padding:2rem;">No fields matched search criteria.</td></tr>`;
  }

  function setupDictionaryEvents() {
    if (dom.dictSearch) {
      dom.dictSearch.addEventListener('input', renderDataDictionary);
    }
    if (dom.dictTypeFilter) {
      dom.dictTypeFilter.addEventListener('change', renderDataDictionary);
    }
  }

  // --- INSIGHTS RENDERING ---
  function renderInsights() {
    if (!dom.insightsContainer || !state.eda.analytical_questions) return;
    const questions = state.eda.analytical_questions;

    let html = '';
    Object.keys(questions).forEach((key, idx) => {
      const item = questions[key];
      const category = idx <= 5 ? 'dietary' : idx <= 9 ? 'lifestyle' : idx <= 12 ? 'academic' : 'financial';

      html += `
        <div class="insight-card" data-category="${category}">
          <div class="insight-header">
            <span class="badge badge-primary">Analytical Question ${idx + 1}</span>
            <span class="badge badge-secondary">${category.toUpperCase()}</span>
          </div>
          <h3 class="insight-title">${item.question}</h3>
          <div style="margin: 0.75rem 0; font-size: 1.1rem; color: var(--primary-dark); font-weight: 700;">
            ${item.metric}
          </div>
          <p style="font-size: 0.92rem; color: var(--text-main); margin-bottom: 0.75rem;">
            ${item.interpretation}
          </p>
          <div class="insight-meta">
            <div>
              <div class="insight-field-label">Empirical Evidence</div>
              <div class="insight-field-val">${item.evidence}</div>
            </div>
            <div>
              <div class="insight-field-label">Actionable Implication</div>
              <div class="insight-field-val">Leverage targeted behavioral nudges and campus food adjustments.</div>
            </div>
          </div>
        </div>
      `;
    });

    dom.insightsContainer.innerHTML = html;
  }

  function setupInsightFilters() {
    dom.insightFilterBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        dom.insightFilterBtns.forEach(b => b.classList.remove('active', 'btn-primary'));
        dom.insightFilterBtns.forEach(b => b.classList.add('btn-secondary'));
        btn.classList.add('active', 'btn-primary');
        btn.classList.remove('btn-secondary');

        const cat = btn.getAttribute('data-category');
        document.querySelectorAll('.insight-card').forEach(card => {
          if (cat === 'all' || card.getAttribute('data-category') === cat) {
            card.style.display = 'block';
          } else {
            card.style.display = 'none';
          }
        });
      });
    });
  }

  // --- TABLEAU DASHBOARDS SIMULATION & VISUALIZATIONS ---
  function setupDashboardTabs() {
    dom.dashTabs.forEach(tab => {
      tab.addEventListener('click', () => {
        dom.dashTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        const targetId = tab.getAttribute('data-tab');
        state.activeDashboardTab = targetId;

        dom.dashPanels.forEach(p => {
          if (p.id === targetId) {
            p.classList.add('active');
          } else {
            p.classList.remove('active');
          }
        });

        renderCurrentDashboardCharts();
      });
    });
  }

  function renderHomeCharts() {
    if (typeof Chart === 'undefined') return;

    // Home Chart: Produce Consumption by Year of Study
    const ctxProduce = document.getElementById('chartHomeProduce');
    if (ctxProduce) {
      if (state.charts.homeProduce) state.charts.homeProduce.destroy();
      state.charts.homeProduce = new Chart(ctxProduce, {
        type: 'bar',
        data: {
          labels: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'],
          datasets: [
            { label: 'Fruit Servings/day', data: [1.38, 1.55, 1.74, 1.88, 2.05], backgroundColor: '#10b981' },
            { label: 'Vegetable Servings/day', data: [1.52, 1.76, 1.98, 2.15, 2.38], backgroundColor: '#3b82f6' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: { y: { beginAtZero: true, title: { display: true, text: 'Servings per Day' } } }
        }
      });
    }

    // Home Chart 2: Dietary Score Distribution
    const ctxScore = document.getElementById('chartHomeDietScore');
    if (ctxScore) {
      if (state.charts.homeScore) state.charts.homeScore.destroy();
      state.charts.homeScore = new Chart(ctxScore, {
        type: 'doughnut',
        data: {
          labels: ['Higher Dietary Score (>=70)', 'Moderate Dietary Score (45-69)', 'Lower Dietary Score (<45)'],
          datasets: [{
            data: [
              state.eda.distributions?.dietary_score_category?.['Higher Dietary Score']?.count || 420,
              state.eda.distributions?.dietary_score_category?.['Moderate Dietary Score']?.count || 710,
              state.eda.distributions?.dietary_score_category?.['Lower Dietary Score']?.count || 120
            ],
            backgroundColor: ['#10b981', '#f59e0b', '#ef4444']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'bottom' } }
        }
      });
    }
  }

  function renderCurrentDashboardCharts() {
    if (typeof Chart === 'undefined') return;

    if (state.activeDashboardTab === 'dash-executive') {
      renderExecutiveDashboardCharts();
    } else if (state.activeDashboardTab === 'dash-dietary') {
      renderDietaryDashboardCharts();
    } else if (state.activeDashboardTab === 'dash-academic') {
      renderAcademicDashboardCharts();
    } else if (state.activeDashboardTab === 'dash-strategy') {
      renderStrategyDashboardCharts();
    }
  }

  function renderExecutiveDashboardCharts() {
    const ctx1 = document.getElementById('chartExecDietYear');
    if (ctx1) {
      if (state.charts.exec1) state.charts.exec1.destroy();
      state.charts.exec1 = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate'],
          datasets: [
            { label: 'Avg Dietary Health Score (0-100)', data: [58.8, 61.2, 65.4, 68.1, 71.3], backgroundColor: '#6366f1' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { min: 40, max: 80, title: { display: true, text: 'Dietary Health Score' } } }
        }
      });
    }

    const ctx2 = document.getElementById('chartExecResidence');
    if (ctx2) {
      if (state.charts.exec2) state.charts.exec2.destroy();
      state.charts.exec2 = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: ['On-Campus Dormitory', 'Off-Campus Apartment', 'With Family', 'Greek Housing'],
          datasets: [
            { label: 'Weekly Fast Food Meals', data: [3.4, 2.5, 1.4, 3.6], backgroundColor: '#ef4444' },
            { label: 'Home Cooked Meals', data: [3.1, 7.5, 10.4, 2.8], backgroundColor: '#10b981' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: { y: { beginAtZero: true, title: { display: true, text: 'Meals / Week' } } }
        }
      });
    }
  }

  function renderDietaryDashboardCharts() {
    const ctx1 = document.getElementById('chartDietBreakfastGPA');
    if (ctx1) {
      if (state.charts.diet1) state.charts.diet1.destroy();
      state.charts.diet1 = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: ['0-1 Days', '2-3 Days', '4-5 Days', '6-7 Days (Daily)'],
          datasets: [
            { label: 'Student Count', data: [215, 340, 410, 285], backgroundColor: '#cbd5e1', yAxisID: 'y' },
            { label: 'Average GPA', data: [3.28, 3.36, 3.48, 3.54], type: 'line', borderColor: '#2563eb', backgroundColor: '#2563eb', yAxisID: 'y1' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: {
            y: { type: 'linear', position: 'left', title: { display: true, text: 'Number of Students' } },
            y1: { type: 'linear', position: 'right', min: 3.0, max: 3.8, grid: { drawOnChartArea: false }, title: { display: true, text: 'Average GPA' } }
          }
        }
      });
    }

    const ctx2 = document.getElementById('chartDietWaterBox');
    if (ctx2) {
      if (state.charts.diet2) state.charts.diet2.destroy();
      state.charts.diet2 = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: ['< 1.0 L (Deficit)', '1.0 - 1.9 L (Borderline)', '2.0 - 2.9 L (Recommended)', '>= 3.0 L (Active)'],
          datasets: [{
            label: '% of Student Population',
            data: [6.4, 23.9, 48.5, 21.2],
            backgroundColor: ['#ef4444', '#f59e0b', '#3b82f6', '#10b981']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: { y: { beginAtZero: true, max: 60, title: { display: true, text: '% of Cohort' } } }
        }
      });
    }
  }

  function renderAcademicDashboardCharts() {
    const ctx1 = document.getElementById('chartAcadSleepGPA');
    if (ctx1) {
      if (state.charts.acad1) state.charts.acad1.destroy();
      state.charts.acad1 = new Chart(ctx1, {
        type: 'line',
        data: {
          labels: ['4.5h', '5.0h', '5.5h', '6.0h', '6.5h', '7.0h', '7.5h', '8.0h', '8.5h', '9.0h+'],
          datasets: [
            { label: 'Average GPA by Sleep Cohort', data: [3.08, 3.16, 3.24, 3.33, 3.42, 3.51, 3.55, 3.53, 3.47, 3.41], borderColor: '#6366f1', tension: 0.3, fill: false }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          scales: { y: { min: 2.8, max: 3.8, title: { display: true, text: 'Cumulative GPA' } } }
        }
      });
    }

    const ctx2 = document.getElementById('chartAcadStressDiet');
    if (ctx2) {
      if (state.charts.acad2) state.charts.acad2.destroy();
      state.charts.acad2 = new Chart(ctx2, {
        type: 'bar',
        data: {
          labels: ['Low Stress', 'Moderate Stress', 'High Stress'],
          datasets: [
            { label: 'Dietary Health Score', data: [68.4, 64.2, 59.8], backgroundColor: '#10b981' },
            { label: 'Weekly Fast Food Meals', data: [1.8, 2.6, 3.5], backgroundColor: '#ef4444' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } }
        }
      });
    }
  }

  function renderStrategyDashboardCharts() {
    const ctx1 = document.getElementById('chartStrategyImpact');
    if (ctx1) {
      if (state.charts.strat1) state.charts.strat1.destroy();
      state.charts.strat1 = new Chart(ctx1, {
        type: 'bar',
        data: {
          labels: ['Breakfast Regularity', 'Adequate Hydration (>=2L)', 'Produce (>=3 serv)', 'Fast Food Moderation (<3d)'],
          datasets: [
            { label: 'Current Baseline (%)', data: [37.9, 69.7, 32.4, 46.1], backgroundColor: '#94a3b8' },
            { label: 'Target With Strategies (%)', data: [65.0, 88.0, 58.0, 72.0], backgroundColor: '#10b981' }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { position: 'top' } },
          scales: { y: { beginAtZero: true, max: 100, title: { display: true, text: 'Prevalence Rate (%)' } } }
        }
      });
    }
  }

  // --- INITIALIZATION ---
  function init() {
    setupRouting();
    setupExplorerEvents();
    setupDictionaryEvents();
    setupInsightFilters();
    setupDashboardTabs();

    renderDataDictionary();
    renderInsights();
    renderHomeCharts();

    // Print Report listener
    if (dom.printReportBtn) {
      dom.printReportBtn.addEventListener('click', () => {
        window.print();
      });
    }

    console.log("College Food Choices Analytics Platform initialized successfully.");
  }

  // Launch on DOM Ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();

// =================================================================
// ===================== APP CONFIGURATION =========================
// =================================================================

// Centralized mapping of form IDs to data keys. This improves maintainability.
const EMPLOYEE_FIELD_MAP = {
    employeeNumber: 'رقم الموظف',
    arabicName: 'اسم الموظف باللغة العربية',
    englishName: 'اسم الموظف باللغة الإنجليزية',
    civilId: 'البطاقة المدنية',
    civilIdExpiry: 'تاريخ انتهاء البطاقة',
    nationality: 'الجنسية',
    passportNumber: 'رقم جواز السفر',
    passportExpiry: 'تاريخ انتهاء الجواز',
    unifiedNumber: 'الرقم الموحد',
    contractDate: 'تاريخ التعاقد',
    contractStatus: 'حالة التعاقد',
    workSite: 'موقع العمل',
    jobTitle: 'المهنة',
    workSchedule: 'نظام الدوام',
    currentSalary: 'الراتب الحالي للموظف',
    workPermitSalary: 'الراتب حسب اذن العمل',
    companyName: 'اسم الشركة',
    adminNotes: 'ملاحظات إدارية',
    additionalNotes: 'اضافات اخرى',
};

// Updated sample data for template download to match the new 19-column structure.
const initialEmployeesData = [
    {
        'رقم الموظف': '60000',
        'اسم الموظف باللغة العربية': 'حسن فلاح المعصب',
        'البطاقة المدنية': '293293293293',
        'تاريخ انتهاء البطاقة': '2026/06/29',
        الجنسية: 'كويتي',
        'رقم جواز السفر': 'A12345678',
        'تاريخ انتهاء الجواز': '2088/11/10',
        'الرقم الموحد': '123456789',
        'تاريخ التعاقد': '1993/07/09',
        'حالة التعاقد': 'منتهى',
        'موقع العمل': 'عماله وطنية الكويتيين - الإدارة الرئيسية',
        'اسم الشركة': 'شركة بروش انترناشونال لخدمات التنظيف',
        'الراتب الحالي للموظف': '800',
        'الراتب حسب اذن العمل': '700',
        المهنة: 'مدير عام',
        'نظام الدوام': 'دوامين',
        'اسم الموظف باللغة الإنجليزية': 'HASSAN FALAH ALMOASB',
        'ملاحظات إدارية': 'باب خامس (الكويتيين)',
        'اضافات اخرى': 'لا توجد إضافات',
    },
];

// =================================================================
// ===================== GLOBAL VARIABLES ==========================
// =================================================================
let employees = [];
let filteredEmployees = [];
let currentEmployeeId = null;
let isEditMode = false;
let alertsCount = 0;
let importedFile = null;

// =================================================================
// =================== INITIALIZATION & DATA LOADING ===============
// =================================================================

document.addEventListener('DOMContentLoaded', async function () {
    const onLoginPage = window.location.pathname.endsWith('/login.html');
    const isAuthenticated = localStorage.getItem('hr_authenticated') === 'true';

    if (onLoginPage) {
        document
            .getElementById('loginForm')
            .addEventListener('submit', handleLogin);
        if (isAuthenticated) {
            window.location.href = '/'; // Redirect if already logged in
        }
    } else {
        if (!isAuthenticated) {
            window.location.href = '/login.html'; // Redirect to login if not authenticated
        } else {
            // User is authenticated and not on login page, proceed to initialize the app
            document.getElementById('dashboard').style.display = 'block';
            await initializeApp();
        }
    }
});

async function initializeApp() {
    showLoadingOverlay('جاري تحميل بيانات الموظفين...');
    try {
        const loadedFromFile = await loadInitialData();
        if (!loadedFromFile) {
            console.log('No data file found, loading from local storage.');
            loadEmployeesFromStorage();
        }
        setupEventListeners();
        updateDateTime();
        setInterval(updateDateTime, 1000);
        checkSystemTheme();
        runPageSpecificScripts();
    } catch (error) {
        console.error('Error initializing app:', error);
        showNotification('حدث خطأ أثناء تحميل البيانات', 'error');
    } finally {
        hideLoadingOverlay();
    }
}

function runPageSpecificScripts() {
    const path = window.location.pathname;

    // This will run on all pages
    renderAlerts(); // To update the badge count in the sidebar

    if (path === '/' || path.endsWith('/index.html')) {
        updateStatistics();
        updateRecentActivity();
    } else if (path.endsWith('/employees.html')) {
        showEmployeeList();
        populateFilters();
        renderEmployeeTable();
    } else if (path.endsWith('/analytics.html')) {
        createCharts();
    } else if (path.endsWith('/alerts.html')) {
        // renderAlerts is already called above, but we ensure it's rendered in the main content too
        renderAlerts();
    } else if (path.endsWith('/settings.html')) {
        updateSystemInfo();
    }
}

async function loadInitialData() {
    const filePaths = [
        { path: '/db/DB.xlsx', type: 'arrayBuffer', ext: 'xlsx' },
        { path: '/db/DB.json', type: 'text', ext: 'json' },
        { path: '/db/DB.yml', type: 'text', ext: 'yml' },
        { path: '/db/DB.csv', type: 'text', ext: 'csv' },
    ];

    for (const fileInfo of filePaths) {
        try {
            updateLoadingMessage(`جاري التحقق من وجود ${fileInfo.path}...`);
            const response = await fetch(fileInfo.path, { cache: 'no-store' });
            if (response.ok) {
                console.log(`Found database file: ${fileInfo.path}`);
                const content = await response[fileInfo.type]();
                const parsedData = parseFileContent(content, fileInfo.ext);

                if (
                    parsedData &&
                    Array.isArray(parsedData) &&
                    parsedData.length > 0
                ) {
                    employees = parsedData;
                    filteredEmployees = [...employees];
                    saveEmployeesToStorage();
                    showNotification(
                        `تم تحميل ${employees.length} موظف من ملف البيانات`,
                        'success'
                    );
                    return true;
                }
            }
        } catch (error) {
            console.log(`Could not fetch ${fileInfo.path}: ${error.message}`);
        }
    }
    return false;
}

function parseFileContent(content, extension) {
    let rawData;
    try {
        switch (extension) {
            case 'xlsx':
            case 'xls':
                const workbook = XLSX.read(content, {
                    type: 'array',
                    cellDates: true,
                });
                const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                rawData = XLSX.utils.sheet_to_json(firstSheet, { defval: '' });
                break;
            case 'csv':
                rawData = parseCsv(content);
                break;
            case 'json':
                rawData = JSON.parse(content);
                break;
            case 'yml':
            case 'yaml':
                rawData = jsyaml.load(content);
                break;
            default:
                return [];
        }
        return Array.isArray(rawData) ? standardizeData(rawData) : [];
    } catch (error) {
        console.error(`Error parsing ${extension} file:`, error);
        showNotification(
            `خطأ في تحليل ملف البيانات: ${error.message}`,
            'error'
        );
        return [];
    }
}

// =================================================================
// ===================== DATA STORAGE ==============================
// =================================================================

function loadEmployeesFromStorage() {
    const data = localStorage.getItem('hrSystemData');
    if (data) {
        try {
            employees = JSON.parse(data).employees || [];
        } catch {
            employees = [];
        }
    } else {
        employees = [];
    }
    filteredEmployees = [...employees];
}

function saveEmployeesToStorage() {
    const dataToSave = {
        employees: employees,
        lastUpdate: new Date().toISOString(),
    };
    localStorage.setItem('hrSystemData', JSON.stringify(dataToSave));
    updateSystemInfo();
}

// =================================================================
// ===================== EVENT LISTENERS ===========================
// =================================================================

function setupEventListeners() {
    // These listeners are for elements present on the 'default' layout
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) logoutBtn.addEventListener('click', handleLogout);

    const headerThemeToggle = document.getElementById('headerThemeToggle');
    if (headerThemeToggle)
        headerThemeToggle.addEventListener('click', toggleTheme);

    const sidebarToggle = document.getElementById('sidebarToggle');
    if (sidebarToggle) sidebarToggle.addEventListener('click', toggleSidebar);

    const quickAddEmployee = document.getElementById('quickAddEmployee');
    if (quickAddEmployee)
        quickAddEmployee.addEventListener(
            'click',
            () => (window.location.href = '/employees.html')
        );

    const addEmployeeBtn = document.getElementById('addEmployeeBtn');
    if (addEmployeeBtn)
        addEmployeeBtn.addEventListener('click', () => showEmployeeForm(null));

    const employeeDataForm = document.getElementById('employeeDataForm');
    if (employeeDataForm)
        employeeDataForm.addEventListener('submit', handleSaveEmployee);

    const cancelFormBtn = document.getElementById('cancelFormBtn');
    if (cancelFormBtn)
        cancelFormBtn.addEventListener('click', hideEmployeeForm);

    const searchInput = document.getElementById('searchInput');
    if (searchInput)
        searchInput.addEventListener('input', debounce(filterEmployees, 300));

    [
        'nationalityFilter',
        'statusFilter',
        'jobFilter',
        'workScheduleFilter',
    ].forEach((id) => {
        const filterElement = document.getElementById(id);
        if (filterElement)
            filterElement.addEventListener('change', filterEmployees);
    });

    const clearFiltersBtn = document.getElementById('clearFiltersBtn');
    if (clearFiltersBtn)
        clearFiltersBtn.addEventListener('click', clearFilters);

    const backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.addEventListener('click', showEmployeeList);

    const exportDataBtn = document.getElementById('exportDataBtn');
    if (exportDataBtn) exportDataBtn.addEventListener('click', exportData);

    const importDataInput = document.getElementById('importDataInput');
    if (importDataInput)
        importDataInput.addEventListener('change', handleFileImport);

    const downloadTemplateBtn = document.getElementById('downloadTemplateBtn');
    if (downloadTemplateBtn)
        downloadTemplateBtn.addEventListener('click', downloadSampleTemplate);

    const clearDataBtn = document.getElementById('clearDataBtn');
    if (clearDataBtn) clearDataBtn.addEventListener('click', clearAllData);

    const closeDeleteModal = document.getElementById('closeDeleteModal');
    if (closeDeleteModal)
        closeDeleteModal.addEventListener('click', hideDeleteModal);

    const cancelDeleteBtn = document.getElementById('cancelDeleteBtn');
    if (cancelDeleteBtn)
        cancelDeleteBtn.addEventListener('click', hideDeleteModal);

    const deleteConfirmCheckbox = document.getElementById(
        'deleteConfirmCheckbox'
    );
    if (deleteConfirmCheckbox)
        deleteConfirmCheckbox.addEventListener(
            'change',
            checkDeleteConfirmation
        );

    const deleteConfirmText = document.getElementById('deleteConfirmText');
    if (deleteConfirmText)
        deleteConfirmText.addEventListener('input', checkDeleteConfirmation);

    const confirmDeleteBtn = document.getElementById('confirmDeleteBtn');
    if (confirmDeleteBtn)
        confirmDeleteBtn.addEventListener('click', confirmDeleteEmployee);

    const closeRestoreModal = document.getElementById('closeRestoreModal');
    if (closeRestoreModal)
        closeRestoreModal.addEventListener('click', hideRestoreModal);

    const cancelRestoreBtn = document.getElementById('cancelRestoreBtn');
    if (cancelRestoreBtn)
        cancelRestoreBtn.addEventListener('click', hideRestoreModal);

    const confirmRestoreBtn = document.getElementById('confirmRestoreBtn');
    if (confirmRestoreBtn)
        confirmRestoreBtn.addEventListener('click', confirmRestoreBackup);

    const quickViewAlerts = document.getElementById('quickViewAlerts');
    if (quickViewAlerts)
        quickViewAlerts.addEventListener(
            'click',
            () => (window.location.href = '/alerts.html')
        );

    const quickGenerateReport = document.getElementById('quickGenerateReport');
    if (quickGenerateReport)
        quickGenerateReport.addEventListener('click', generateReport);

    const cancelLoadingBtn = document.getElementById('cancelLoadingBtn');
    if (cancelLoadingBtn)
        cancelLoadingBtn.addEventListener('click', () => {
            hideLoadingOverlay();
            showNotification('تم إلغاء تحميل البيانات', 'warning');
        });

    const tabBtns = document.querySelectorAll('.tab-btn');
    if (tabBtns)
        tabBtns.forEach((btn) => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
        });
}

// =================================================================
// ===================== AUTH & NAVIGATION =========================
// =================================================================

function handleLogin(e) {
    e.preventDefault();
    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    if (username.toUpperCase() === 'ADMIN' && password === 'admin') {
        localStorage.setItem('hr_authenticated', 'true');
        window.location.href = '/';
    } else {
        const errorMessage = document.getElementById('errorMessage');
        errorMessage.textContent = 'اسم المستخدم أو كلمة المرور غير صحيحة';
        errorMessage.style.color = 'var(--danger-color)';
        errorMessage.style.marginTop = '10px';
    }
}

function handleLogout() {
    localStorage.removeItem('hr_authenticated');
    window.location.href = '/login.html';
}

// =================================================================
// ===================== UI & DISPLAY FUNCTIONS ====================
// =================================================================

function updateStatistics() {
    const totalEmployeesEl = document.getElementById('totalEmployees');
    if (!totalEmployeesEl) return;

    const totalEmployees = employees.length;
    const activeEmployees = employees.filter(
        (emp) => emp['حالة التعاقد'] === 'نشط'
    ).length;
    const inactiveEmployees = totalEmployees - activeEmployees;
    const avgSalary =
        totalEmployees > 0
            ? Math.round(
                  employees.reduce(
                      (sum, emp) =>
                          sum + Number(emp['الراتب الحالي للموظف'] || 0),
                      0
                  ) / totalEmployees
              )
            : 0;

    document.getElementById('totalEmployees').textContent = totalEmployees;
    document.getElementById('activeEmployees').textContent = activeEmployees;
    document.getElementById('inactiveEmployees').textContent =
        inactiveEmployees;
    document.getElementById('avgSalary').textContent = `${avgSalary} د.ك`;
}

function updateRecentActivity() {
    const recentActivity = document.getElementById('recentActivity');
    if (!recentActivity) return;

    if (employees.length === 0) {
        recentActivity.innerHTML =
            '<p style="text-align: center; color: var(--text-secondary); padding: 20px;">لا يوجد نشاط حديث</p>';
        return;
    }
    const recentEmployees = employees.slice(-5).reverse();
    recentActivity.innerHTML = recentEmployees
        .map(
            (employee) => `
        <div class="detail-row">
            <span class="detail-label">${employee['اسم الموظف باللغة العربية']}</span>
            <span class="detail-value">تمت إضافة/تحديث البيانات</span>
        </div>
    `
        )
        .join('');
}

function populateFilters() {
    const nationalityFilter = document.getElementById('nationalityFilter');
    if (!nationalityFilter) return;

    const createOptions = (key) =>
        [...new Set(employees.map((emp) => emp[key]).filter(Boolean))]
            .sort()
            .map((val) => `<option value="${val}">${val}</option>`)
            .join('');
    document.getElementById(
        'nationalityFilter'
    ).innerHTML = `<option value="">جميع الجنسيات</option>${createOptions(
        'الجنسية'
    )}`;
    document.getElementById(
        'jobFilter'
    ).innerHTML = `<option value="">جميع المهن</option>${createOptions(
        'المهنة'
    )}`;
    document.getElementById(
        'workScheduleFilter'
    ).innerHTML = `<option value="">كل أنظمة الدوام</option>${createOptions(
        'نظام الدوام'
    )}`;
}

function renderEmployeeTable() {
    const tbody = document.getElementById('employeeTableBody');
    if (!tbody) return;

    const employeeCount = document.getElementById('employeeCount');
    if (filteredEmployees.length === 0) {
        tbody.innerHTML =
            '<tr><td colspan="7" class="no-results">لا توجد نتائج</td></tr>';
        employeeCount.textContent = '0 موظف';
        return;
    }
    employeeCount.textContent = `${filteredEmployees.length} موظف`;
    tbody.innerHTML = filteredEmployees
        .map(
            (employee) => `
        <tr>
            <td data-label="رقم الموظف" class="employee-id">${
                employee['رقم الموظف']
            }</td>
            <td data-label="الاسم">${employee['اسم الموظف باللغة العربية']}</td>
            <td data-label="الجنسية">${employee['الجنسية']}</td>
            <td data-label="المهنة">${employee['المهنة']}</td>
            <td data-label="حالة التعاقد" class="${
                employee['حالة التعاقد'] === 'نشط'
                    ? 'status-active'
                    : 'status-inactive'
            }">${employee['حالة التعاقد']}</td>
            <td data-label="الراتب" class="salary">${
                employee['الراتب الحالي للموظف']
            } د.ك</td>
            <td data-label="الإجراءات">
                <div class="action-buttons">
                    <button class="btn btn-info btn-sm" onclick="showEmployeeDetails('${
                        employee['رقم الموظف']
                    }')" title="عرض"><i class="fas fa-eye"></i></button>
                    <button class="btn btn-warning btn-sm" onclick="editEmployee('${
                        employee['رقم الموظف']
                    }')" title="تعديل"><i class="fas fa-edit"></i></button>
                    <button class="btn btn-danger btn-sm" onclick="showDeleteModal('${
                        employee['رقم الموظف']
                    }')" title="حذف"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `
        )
        .join('');
}

function showEmployeeDetails(employeeId) {
    const employee = employees.find(
        (emp) => String(emp['رقم الموظف']) === String(employeeId)
    );
    if (!employee) return;

    hideMainListView();
    document.getElementById('employeeDetails').style.display = 'block';

    const detailsContent = document.getElementById('employeeDetailsContent');
    const getDetail = (key) => employee[key] || '--';

    detailsContent.innerHTML = `
        <div class="details-header"><h2>${getDetail(
            'اسم الموظف باللغة العربية'
        )}</h2><p>${getDetail('اسم الموظف باللغة الإنجليزية')}</p></div>
        <div class="details-grid">
            <div class="detail-section"><h3>المعلومات الأساسية</h3>
                <div class="detail-row"><span class="detail-label">رقم الموظف:</span><span class="detail-value">${getDetail(
                    'رقم الموظف'
                )}</span></div>
                <div class="detail-row"><span class="detail-label">البطاقة المدنية:</span><span class="detail-value">${getDetail(
                    'البطاقة المدنية'
                )}</span></div>
                <div class="detail-row"><span class="detail-label">انتهاء البطاقة:</span><span class="detail-value">${formatDateForDisplay(
                    getDetail('تاريخ انتهاء البطاقة')
                )}</span></div>
                <div class="detail-row"><span class="detail-label">الجنسية:</span><span class="detail-value">${getDetail(
                    'الجنسية'
                )}</span></div>
                <div class="detail-row"><span class="detail-label">رقم الجواز:</span><span class="detail-value">${getDetail(
                    'رقم جواز السفر'
                )}</span></div>
                <div class="detail-row"><span class="detail-label">انتهاء الجواز:</span><span class="detail-value">${formatDateForDisplay(
                    getDetail('تاريخ انتهاء الجواز')
                )}</span></div>
            </div>
            <div class="detail-section"><h3>معلومات الوظيفة</h3>
                <div class="detail-row"><span class="detail-label">تاريخ التعاقد:</span><span class="detail-value">${formatDateForDisplay(
                    getDetail('تاريخ التعاقد')
                )}</span></div>
                <div class="detail-row"><span class="detail-label">الحالة:</span><span class="detail-value ${
                    getDetail('حالة التعاقد') === 'نشط'
                        ? 'status-active'
                        : 'status-inactive'
                }">${getDetail('حالة التعاقد')}</span></div>
                <div class="detail-row"><span class="detail-label">المهنة:</span><span class="detail-value">${getDetail(
                    'المهنة'
                )}</span></div>
                <div class="detail-row"><span class="detail-label">نظام الدوام:</span><span class="detail-value">${getDetail(
                    'نظام الدوام'
                )}</span></div>
                <div class="detail-row"><span class="detail-label">الراتب الحالي:</span><span class="detail-value salary">${getDetail(
                    'الراتب الحالي للموظف'
                )} د.ك</span></div>
                <div class="detail-row"><span class="detail-label">موقع العمل:</span><span class="detail-value">${getDetail(
                    'موقع العمل'
                )}</span></div>
            </div>
            <div class="detail-section"><h3>معلومات الشركة</h3>
                <div class="detail-row"><span class="detail-label">اسم الشركة:</span><span class="detail-value">${getDetail(
                    'اسم الشركة'
                )}</span></div>
                <div class="detail-row"><span class="detail-label">ملاحظات إدارية:</span><span class="detail-value">${getDetail(
                    'ملاحظات إدارية'
                )}</span></div>
                <div class="detail-row"><span class="detail-label">راتب إذن العمل:</span><span class="detail-value">${getDetail(
                    'الراتب حسب اذن العمل'
                )} د.ك</span></div>
                <div class="detail-row"><span class="detail-label">اضافات اخرى:</span><span class="detail-value">${getDetail(
                    'اضافات اخرى'
                )}</span></div>
            </div>
        </div>`;
}

function renderAlerts() {
    const alertsContainer = document.getElementById('alertsContainer');
    const alertsCountBadge = document.getElementById('alertsCount');
    if (!alertsCountBadge) return;

    const currentDate = new Date();
    currentDate.setUTCHours(0, 0, 0, 0);

    const alerts = [];
    employees.forEach((employee) => {
        const checkExpiry = (dateStr, type) => {
            if (!dateStr) return;
            const expiryDate = parseDate(dateStr);
            if (expiryDate) {
                const daysDiff = Math.ceil(
                    (expiryDate - currentDate) / (1000 * 60 * 60 * 24)
                );
                if (daysDiff >= 0 && daysDiff <= 30) {
                    const title =
                        type === 'civilId'
                            ? 'انتهاء البطاقة المدنية'
                            : 'انتهاء جواز السفر';
                    const message = `${title.split(' ')[0]} للموظف ${
                        employee['اسم الموظف باللغة العربية']
                    } ${daysDiff === 0 ? 'اليوم' : `خلال ${daysDiff} يوم`}.`;
                    alerts.push({
                        type: 'critical',
                        title: title,
                        message: message,
                        date: formatDateForDisplay(dateStr),
                    });
                }
            }
        };
        checkExpiry(employee['تاريخ انتهاء البطاقة'], 'civilId');
        checkExpiry(employee['تاريخ انتهاء الجواز'], 'passport');
    });

    alertsCount = alerts.length;
    alertsCountBadge.textContent = alertsCount;

    if (alertsContainer) {
        if (alerts.length === 0) {
            alertsContainer.innerHTML = `<div class="alert alert-success"><i class="fas fa-check-circle"></i> لا توجد تنبيهات حالياً.</div>`;
        } else {
            alertsContainer.innerHTML = alerts
                .sort((a, b) => parseDate(a.date) - parseDate(b.date))
                .map(
                    (alert) => `
                    <div class="alert-card ${alert.type}">
                        <div class="alert-header">
                            <div class="alert-title">${alert.title}</div>
                            <div class="alert-date">${alert.date}</div>
                        </div>
                        <div class="alert-content"><p>${alert.message}</p></div>
                    </div>
                `
                )
                .join('');
        }
    }
}

// =================================================================
// ===================== EMPLOYEE CRUD & FORMS =====================
// =================================================================

function handleSaveEmployee(e) {
    e.preventDefault();
    const form = document.getElementById('employeeDataForm');
    const formData = new FormData(form);
    const employeeData = {};

    const requiredFormFields = [
        'employeeNumber',
        'arabicName',
        'englishName',
        'civilId',
        'civilIdExpiry',
        'nationality',
        'contractDate',
        'contractStatus',
        'jobTitle',
        'workSchedule',
        'currentSalary',
    ];
    for (const field of requiredFormFields) {
        if (!formData.get(field)) {
            showNotification('يرجى ملء جميع الحقول الإلزامية (*)', 'warning');
            return;
        }
    }

    const newEmployeeId = formData.get('employeeNumber');
    if (
        !isEditMode &&
        employees.some(
            (emp) => String(emp['رقم الموظف']) === String(newEmployeeId)
        )
    ) {
        showNotification(
            'رقم الموظف موجود مسبقاً، يرجى استخدام رقم آخر',
            'error'
        );
        return;
    }

    for (const [formId, dataKey] of Object.entries(EMPLOYEE_FIELD_MAP)) {
        employeeData[dataKey] = formData.get(formId);
    }

    if (isEditMode) {
        const index = employees.findIndex(
            (emp) => String(emp['رقم الموظف']) === String(currentEmployeeId)
        );
        if (index !== -1) employees[index] = employeeData;
    } else {
        employees.push(employeeData);
    }

    saveAndRefresh();
    hideEmployeeForm();
    showNotification('تم حفظ بيانات الموظف بنجاح', 'success');
}

function populateForm(employee) {
    document.getElementById('employeeDataForm').reset();
    for (const [formId, dataKey] of Object.entries(EMPLOYEE_FIELD_MAP)) {
        const element = document.getElementById(formId);
        if (element && employee[dataKey] !== undefined) {
            element.value =
                element.type === 'date'
                    ? formatDateForInput(employee[dataKey])
                    : employee[dataKey];
        }
    }
}

function filterEmployees() {
    const searchTerm = document
        .getElementById('searchInput')
        .value.toLowerCase();
    const nationality = document.getElementById('nationalityFilter').value;
    const status = document.getElementById('statusFilter').value;
    const job = document.getElementById('jobFilter').value;
    const schedule = document.getElementById('workScheduleFilter').value;

    filteredEmployees = employees.filter(
        (emp) =>
            (!nationality || emp['الجنسية'] === nationality) &&
            (!status || emp['حالة التعاقد'] === status) &&
            (!job || emp['المهنة'] === job) &&
            (!schedule || emp['نظام الدوام'] === schedule) &&
            ((emp['اسم الموظف باللغة العربية'] || '')
                .toLowerCase()
                .includes(searchTerm) ||
                (emp['اسم الموظف باللغة الإنجليزية'] || '')
                    .toLowerCase()
                    .includes(searchTerm) ||
                (String(emp['رقم الموظف']) || '').includes(searchTerm))
    );
    renderEmployeeTable();
}

function clearFilters() {
    document.getElementById('searchInput').value = '';
    [
        'nationalityFilter',
        'statusFilter',
        'jobFilter',
        'workScheduleFilter',
    ].forEach((id) => {
        document.getElementById(id).value = '';
    });
    filterEmployees();
    showNotification('تم إزالة جميع الفلاتر', 'info');
}

function showEmployeeForm(employeeId = null) {
    isEditMode = !!employeeId;
    currentEmployeeId = employeeId;
    hideMainListView();
    document.getElementById('employeeForm').style.display = 'block';
    document.getElementById('employeeDataForm').reset();
    switchTab('personal');

    if (isEditMode) {
        const employee = employees.find(
            (emp) => String(emp['رقم الموظف']) === String(employeeId)
        );
        if (employee) populateForm(employee);
    } else {
        // You might want a function to generate a new unique ID
        // document.getElementById('employeeNumber').value = generateEmployeeId();
    }
}

function editEmployee(employeeId) {
    showEmployeeForm(employeeId);
}

function confirmDeleteEmployee() {
    if (currentEmployeeId) {
        employees = employees.filter(
            (emp) => String(emp['رقم الموظف']) !== String(currentEmployeeId)
        );
        saveAndRefresh();
        showNotification('تم حذف الموظف بنجاح', 'success');
    }
    hideDeleteModal();
}

// =================================================================
// ===================== UI HELPERS & MODALS =======================
// =================================================================

function hideMainListView() {
    const list = document.getElementById('employeeList');
    if (list) list.style.display = 'none';

    const filter = document.querySelector('.search-filter');
    if (filter) filter.style.display = 'none';
}

function hideEmployeeForm() {
    const form = document.getElementById('employeeForm');
    if (form) form.style.display = 'none';
    showEmployeeList();
}

function showEmployeeList() {
    const details = document.getElementById('employeeDetails');
    if (details) details.style.display = 'none';

    const form = document.getElementById('employeeForm');
    if (form) form.style.display = 'none';

    const list = document.getElementById('employeeList');
    if (list) list.style.display = 'block';

    const filter = document.querySelector('.search-filter');
    if (filter) filter.style.display = 'flex';
}

function switchTab(tabId) {
    document
        .querySelectorAll('.tab-btn')
        .forEach((btn) => btn.classList.remove('active'));
    document
        .querySelectorAll('.tab-content')
        .forEach((content) => content.classList.remove('active'));
    document
        .querySelector(`.tab-btn[data-tab="${tabId}"]`)
        .classList.add('active');
    document.getElementById(`${tabId}-tab`).classList.add('active');
}

function showDeleteModal(employeeId) {
    currentEmployeeId = employeeId;
    document.getElementById('deleteModal').style.display = 'block';
    document.getElementById('deleteConfirmCheckbox').checked = false;
    document.getElementById('deleteConfirmText').value = '';
    document.getElementById('confirmDeleteBtn').disabled = true;
}

function hideDeleteModal() {
    document.getElementById('deleteModal').style.display = 'none';
}

function checkDeleteConfirmation() {
    const checkbox = document.getElementById('deleteConfirmCheckbox').checked;
    const textInput = document.getElementById('deleteConfirmText').value.trim();
    // Adjusted confirmation text to match the prompt in the modal
    document.getElementById('confirmDeleteBtn').disabled = !(
        checkbox && textInput === 'تم'
    );
}

// =================================================================
// ===================== DATE HELPER FUNCTIONS =====================
// =================================================================

function parseDate(dateString) {
    if (!dateString || ['--', '1/0/00', ''].includes(String(dateString).trim()))
        return null;
    if (dateString instanceof Date) return dateString;

    const str = String(dateString).trim();
    let year, month, day;

    const isoMatch = str.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/);
    if (isoMatch) {
        [, year, month, day] = isoMatch.map(Number);
    } else {
        const otherMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/);
        if (otherMatch) {
            [, day, month, year] = otherMatch.map(Number);
        } else {
            return null;
        }
    }

    if (
        isNaN(year) ||
        isNaN(month) ||
        isNaN(day) ||
        month < 1 ||
        month > 12 ||
        day < 1 ||
        day > 31
    )
        return null;

    const date = new Date(Date.UTC(year, month - 1, day));
    if (
        date.getUTCFullYear() !== year ||
        date.getUTCMonth() !== month - 1 ||
        date.getUTCDate() !== day
    )
        return null;

    return date;
}

function formatDateForInput(dateString) {
    const date = parseDate(dateString);
    return date ? date.toISOString().split('T')[0] : '';
}

function formatDateForDisplay(dateString) {
    const date = parseDate(dateString);
    if (!date) return '--';
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}/${month}/${day}`;
}

// =================================================================
// ===================== DATA IMPORT & EXPORT ======================
// =================================================================

function exportData() {
    const ws = XLSX.utils.json_to_sheet(employees);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(
        wb,
        `hr_backup_${new Date().toISOString().split('T')[0]}.xlsx`
    );
    document.getElementById('lastBackupDate').textContent =
        new Date().toLocaleDateString('ar-KW');
    showNotification('تم تصدير البيانات بنجاح', 'success');
}

function handleFileImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    importedFile = file;
    document.getElementById('restoreFileName').textContent = file.name;
    document.getElementById('restoreModal').style.display = 'block';
    event.target.value = '';
}

function hideRestoreModal() {
    document.getElementById('restoreModal').style.display = 'none';
}

async function confirmRestoreBackup() {
    if (!importedFile) return;
    try {
        const importedEmployees = await fetchEmployeesFromFile(importedFile);
        if (importedEmployees && Array.isArray(importedEmployees)) {
            employees = importedEmployees;
            saveAndRefresh();
            showNotification('تم استيراد البيانات بنجاح', 'success');
        } else {
            showNotification('ملف البيانات غير صحيح أو فارغ', 'error');
        }
    } catch (error) {
        showNotification('خطأ في قراءة الملف: ' + error.message, 'error');
    }
    hideRestoreModal();
}

function fetchEmployeesFromFile(file) {
    const extension = file.name.split('.').pop().toLowerCase();
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error('خطأ في قراءة الملف'));
        reader.onload = (e) => {
            try {
                resolve(parseFileContent(e.target.result, extension));
            } catch (error) {
                reject(error);
            }
        };
        ['xlsx', 'xls'].includes(extension)
            ? reader.readAsArrayBuffer(file)
            : reader.readAsText(file);
    });
}

function parseCsv(csvText) {
    const lines = csvText.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map((h) => h.trim());
    return lines.slice(1).map((line) => {
        const values = line.split(',').map((v) => v.trim());
        return headers.reduce((obj, header, index) => {
            obj[header] = values[index] || '';
            return obj;
        }, {});
    });
}

function standardizeData(dataArray) {
    const dateKeys = Object.values(EMPLOYEE_FIELD_MAP).filter((key) =>
        key.includes('تاريخ')
    );
    return dataArray.map((employee) => {
        const newEmployee = {};
        for (const key in employee) {
            const trimmedKey = key.trim();
            newEmployee[trimmedKey] = dateKeys.includes(trimmedKey)
                ? formatDateForDisplay(employee[key])
                : employee[key];
        }
        return newEmployee;
    });
}

function downloadSampleTemplate() {
    const ws = XLSX.utils.json_to_sheet(initialEmployeesData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Employees');
    XLSX.writeFile(wb, 'DATABASE_template.xlsx');
    showNotification('تم تحميل الملف النموذج بنجاح', 'success');
}

function clearAllData() {
    if (
        confirm(
            'هل أنت متأكد من حذف جميع البيانات؟ هذا الإجراء لا يمكن التراجع عنه.'
        ) &&
        confirm('تأكيد أخير: سيتم حذف جميع بيانات الموظفين نهائياً!')
    ) {
        employees = [];
        localStorage.removeItem('hrSystemData');
        saveAndRefresh();
        showNotification('تم حذف جميع البيانات', 'success');
    }
}

// =================================================================
// ===================== MISC UTILITIES ============================
// =================================================================

function saveAndRefresh() {
    saveEmployeesToStorage();
    filteredEmployees = [...employees];

    // Check if we are on the employees page to re-render the table
    if (window.location.pathname.endsWith('/employees.html')) {
        filterEmployees();
        populateFilters();
    }
    renderAlerts(); // Update alerts on all pages
}

function createCharts() {
    const chartElements = [
        'nationalityChart',
        'statusChart',
        'salaryChart',
        'jobTitleChart',
    ];
    let chartsExist = chartElements.every((id) => document.getElementById(id));
    if (!chartsExist) return;

    chartElements.forEach((id) => {
        const canvas = document.getElementById(id);
        if (canvas) {
            const chartInstance = Chart.getChart(canvas);
            if (chartInstance) {
                chartInstance.destroy();
            }
        }
    });

    if (employees.length === 0) {
        console.log('No data available to create charts.');
        return;
    }

    const isDarkMode = document.body.dataset.theme === 'dark';
    const textColor = isDarkMode ? '#ecf0f1' : '#2C3E50';
    const gridColor = isDarkMode
        ? 'rgba(255, 255, 255, 0.1)'
        : 'rgba(0, 0, 0, 0.1)';
    const chartColors = [
        '#E74C3C',
        '#3498DB',
        '#2ECC71',
        '#F1C40F',
        '#9B59B6',
        '#1ABC9C',
        '#E67E22',
        '#34495E',
        '#7F8C8D',
    ];

    // Nationality chart
    const nationalityCtx = document
        .getElementById('nationalityChart')
        .getContext('2d');
    const nationalityCounts = employees.reduce((acc, emp) => {
        const nationality = emp['الجنسية'] || 'غير محدد';
        acc[nationality] = (acc[nationality] || 0) + 1;
        return acc;
    }, {});
    new Chart(nationalityCtx, {
        type: 'pie',
        data: {
            labels: Object.keys(nationalityCounts),
            datasets: [
                {
                    data: Object.values(nationalityCounts),
                    backgroundColor: chartColors,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { color: textColor } },
            },
        },
    });

    // Status chart
    const statusCtx = document.getElementById('statusChart').getContext('2d');
    const statusCounts = employees.reduce((acc, emp) => {
        const status = emp['حالة التعاقد'] || 'غير محدد';
        acc[status] = (acc[status] || 0) + 1;
        return acc;
    }, {});
    new Chart(statusCtx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(statusCounts),
            datasets: [
                {
                    data: Object.values(statusCounts),
                    backgroundColor: ['#2ECC71', '#E74C3C', '#95A5A6'],
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { color: textColor } },
            },
        },
    });

    // Salary chart
    const salaryCtx = document.getElementById('salaryChart').getContext('2d');
    const salaryData = employees.map((emp) =>
        Number(emp['الراتب الحالي للموظف'] || 0)
    );
    const displayLimit = 15;
    const chartLabels = employees.map(
        (emp) => (emp['اسم الموظف باللغة العربية'] || '').split(' ')[0]
    );
    new Chart(salaryCtx, {
        type: 'bar',
        data: {
            labels: chartLabels.slice(0, displayLimit),
            datasets: [
                {
                    label: 'الراتب',
                    data: salaryData.slice(0, displayLimit),
                    backgroundColor: '#3498DB',
                },
            ],
        },
        options: {
            responsive: true,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { color: textColor },
                    grid: { color: gridColor },
                },
                x: { ticks: { color: textColor }, grid: { color: gridColor } },
            },
        },
    });

    // Job title chart
    const jobCtx = document.getElementById('jobTitleChart').getContext('2d');
    const jobCounts = employees.reduce((acc, emp) => {
        const job = emp['المهنة'] || 'غير محدد';
        acc[job] = (acc[job] || 0) + 1;
        return acc;
    }, {});
    new Chart(jobCtx, {
        type: 'polarArea',
        data: {
            labels: Object.keys(jobCounts),
            datasets: [
                {
                    data: Object.values(jobCounts),
                    backgroundColor: chartColors,
                },
            ],
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'bottom', labels: { color: textColor } },
            },
        },
    });
}

function updateSystemInfo() {
    const settingsCount = document.getElementById('settingsEmployeeCount');
    if (!settingsCount) return;

    const data = localStorage.getItem('hrSystemData');
    settingsCount.textContent = employees.length;
    if (data) {
        try {
            const parsed = JSON.parse(data);
            document.getElementById('lastUpdate').textContent = new Date(
                parsed.lastUpdate
            ).toLocaleString('ar-KW');
            document.getElementById('dataSize').textContent = `${(
                new Blob([data]).size / 1024
            ).toFixed(2)} كيلوبايت`;
        } catch {}
    }
}

function generateReport() {
    // This is a placeholder for report generation logic.
    // For now, we can just export the data.
    exportData();
    showNotification('تم إنشاء التقرير وتصديره كملف Excel', 'info');
}

function updateDateTime() {
    const dateTimeEl = document.getElementById('currentDateTime');
    if (!dateTimeEl) return;
    const now = new Date();
    const options = {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
    };
    dateTimeEl.textContent = now.toLocaleDateString('ar-KW', options);
}

function checkSystemTheme() {
    const savedTheme = localStorage.getItem('hr_theme') || 'light';
    document.body.dataset.theme = savedTheme;
    const themeToggle = document.getElementById('headerThemeToggle');
    if (themeToggle) {
        themeToggle.innerHTML = `<i class="fas fa-${
            savedTheme === 'dark' ? 'sun' : 'moon'
        }"></i>`;
    }
}

function toggleTheme() {
    const newTheme = document.body.dataset.theme === 'dark' ? 'light' : 'dark';
    localStorage.setItem('hr_theme', newTheme);
    checkSystemTheme();
    if (window.location.pathname.endsWith('/analytics.html')) createCharts();
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const mainContent = document.getElementById('mainContent');
    const header = document.querySelector('.header');
    sidebar.classList.toggle('collapsed');
    mainContent.classList.toggle('expanded');
    header.classList.toggle('expanded');
    const isCollapsed = sidebar.classList.contains('collapsed');
    const toggleIcon = document.querySelector('#sidebarToggle i');
    toggleIcon.className = `fas fa-chevron-${isCollapsed ? 'left' : 'right'}`;
}

function debounce(func, wait) {
    let timeout;
    return function (...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Make functions globally accessible for inline event handlers
window.showEmployeeDetails = showEmployeeDetails;
window.editEmployee = editEmployee;
window.showDeleteModal = showDeleteModal;

function showLoadingOverlay(message) {
    document.getElementById('loadingMessage').textContent = message;
    document.getElementById('dataLoadingOverlay').style.display = 'flex';
}
function hideLoadingOverlay() {
    document.getElementById('dataLoadingOverlay').style.display = 'none';
}
function updateLoadingMessage(msg) {
    document.getElementById('loadingMessage').textContent = msg;
}

function showNotification(message, type = 'success') {
    document.querySelectorAll('.notification').forEach((n) => n.remove());
    const n = document.createElement('div');
    n.className = `notification ${type}`;
    n.innerHTML = `<i class="fas ${
        type === 'success'
            ? 'fa-check-circle'
            : type === 'error'
            ? 'fa-exclamation-circle'
            : 'fa-info-circle'
    }"></i><span>${message}</span>`;
    document.body.appendChild(n);
    setTimeout(() => {
        n.style.opacity = '0';
        n.style.transition = 'opacity 0.5s';
        setTimeout(() => n.remove(), 500);
    }, 5000);
}

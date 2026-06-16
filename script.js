// ================== إعداد رابط Google Apps Script ==================
const SHEET_API =
    "https://script.google.com/macros/s/AKfycbztYgHeE2Ncvdyq70I7cIVfMGmw8aMKlk-r6RtfIqgg74JGNGrGwElzngkES10MQOO8Zw/exec"; // ← استبدلها برابط الـ exec

// ================== قاعدة البيانات في الواجهة (ذاكرة فقط) ==================
let emp = [];

// ================== تحميل المستخدمين من Google Sheet + كاش ==================
async function refreshUsers(force = false) {
    try {
        if (!force) {
            const cache = localStorage.getItem("users_cache");
            const cacheTime = localStorage.getItem("users_cache_time");
            if (cache && cacheTime) {
                const age = Date.now() - Number(cacheTime);
                // if (age < 0 * 60 * 1000) {
                    emp = JSON.parse(cache);
                    return emp;
              //  }
            }
        }

        const response = await fetch(SHEET_API);
        const result = await response.json();

        if (result.status === "success" && Array.isArray(result.users)) {
            emp = result.users;
        } else {
            emp = [];
        }

        localStorage.setItem("users_cache", JSON.stringify(emp));
        localStorage.setItem("users_cache_time", Date.now());

        return emp;
    } catch (e) {
        console.error("Error loading users:", e);
        if (!emp || emp.length === 0) emp = [];
        return emp;
    }
}


function loadUsers() {
    return emp;
}

// ================== استدعاء API (POST) ==================
async function api(action, data = {}) {
    const response = await fetch(SHEET_API, {
        method: "POST",
        body: JSON.stringify({
            action,
            ...data,
            data
        })
    });

    return response.json();
}

// ================== أدوات التحقق والحماية العامة ==================
function getCurrentUser() {
    const email = localStorage.getItem('loggedInUser');
    if (!email) return null;
    if (!emp || emp.length === 0) return null;
    return emp.find(u => u.email === email) || null;
}

async function requireLogin() {
    let user = getCurrentUser();

    if (!user && localStorage.getItem('loggedInUser')) {
        await refreshUsers(true);
        user = getCurrentUser();
    }

    if (!user) {
        window.location.href = 'index.html';
        return null;
    }
    return user;
}

function protectAdmin() {
    const user = getCurrentUser();
    if (!user || user.admin !== "yes") {
        goToError('403', 'وصول مرفوض', 'هذه الصفحة متاحة للمسؤولين فقط.');
    }
}

function goToError(code, title, desc) {
    window.location.href = `error.html?code=${encodeURIComponent(code)}&title=${encodeURIComponent(title)}&desc=${encodeURIComponent(desc)}`;
}

function setCurrentYear() {
    const yearSpan = document.getElementById('currentYear');
    if (yearSpan) yearSpan.textContent = new Date().getFullYear();
}

// ================== نظام تسجيل الدخول (index.html) ==================
function initLoginPage() {
    const loginForm = document.getElementById('login-form');
    if (!loginForm) return;

    const emailInput = document.getElementById('email');
    const passwordInput = document.getElementById('password');
    const formMessage = document.getElementById('form-message');
    const emailError = document.getElementById('email-error');
    const passwordError = document.getElementById('password-error');
    const loginContainer = document.querySelector('.login-container');
    const welcomeMessageDiv = document.getElementById('welcome-message');
    const logoutButton = document.getElementById('logout-button');

    function clearErrors() {
        emailError.textContent = '';
        passwordError.textContent = '';
        emailInput.classList.remove('invalid');
        passwordInput.classList.remove('invalid');
    }

    const current = getCurrentUser();
    if (current && loginContainer && welcomeMessageDiv) {
        loginContainer.style.display = 'none';
        welcomeMessageDiv.querySelector('p').textContent =
            `أنت مسجل الدخول كـ: ${current.email}`;
        welcomeMessageDiv.style.display = 'block';
    }

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        clearErrors();
        formMessage.textContent = '';
        formMessage.className = 'form-message';

        const emailValue = emailInput.value.trim().toLowerCase();
        const passwordValue = passwordInput.value.trim();

        if (!emailValue || !passwordValue) {
            formMessage.textContent = 'الرجاء تعبئة جميع الحقول.';
            formMessage.classList.add('error');
            return;
        }

        try {
            const result = await api("login", {
                email: emailValue,
                password: passwordValue
            });

            if (result.status !== "success" || !result.user) {
                formMessage.textContent = 'اسم المستخدم أو كلمة السر غير صحيحة!';
                formMessage.classList.add('error');
                return;
            }

            localStorage.setItem('loggedInUser', result.user.email);

            await refreshUsers(true);

            window.location.href =
                (result.user.admin === "yes") ? 'admin.html' : 'main.html';

        } catch (e) {
            console.error("Login error:", e);
            formMessage.textContent = 'حدث خطأ أثناء تسجيل الدخول.';
            formMessage.classList.add('error');
        }
    });

    if (logoutButton) {
        logoutButton.addEventListener('click', () => {
            localStorage.removeItem('loggedInUser');
            window.location.reload();
        });
    }
}

// ================== التحكم وإدارة الصفحات ==================
async function initProtectedPages() {
    const currentPage = window.location.pathname.split('/').pop();
    const protectedPages = [
        'main.html',
        'report.html',
        'inventory.html',
        'complaints.html',
        'admin.html',
        'users.html',
        'add-user.html',
        'edit-user.html'
    ];

    if (protectedPages.includes(currentPage)) {
        const user = await requireLogin();
        if (!user) return;

        const adminOnlyPages = ['admin.html', 'users.html', 'add-user.html', 'edit-user.html'];
        if (adminOnlyPages.includes(currentPage) && user.admin !== "yes") {
            goToError('403', 'وصول مرفوض', 'هذه الصفحة متاحة للمسؤولين فقط.');
            return;
        }
    }

    if (currentPage === 'admin.html') {
        initAdminPage();
    } else if (currentPage === 'users.html') {
        protectAdmin();
        if (typeof loadUsersTable === 'function') loadUsersTable();
    } else if (currentPage === 'add-user.html') {
        protectAdmin();
        loadManagers();
    } else if (currentPage === 'edit-user.html') {
        protectAdmin();
        loadManagers();
        setTimeout(() => {
            if (typeof loadUserData === 'function') loadUserData();
        }, 30);
    } else if (currentPage === 'error.html') {
        initErrorPage();
    }
}

// ================== لوحة تحكم المسؤول ==================
function initAdminPage() {
    const user = getCurrentUser();
    const section = document.getElementById("user_card");
    if (!section || !user) return;

    if (user.email === "promotion.hamwi.o@gmail.com" || user.email === "syrianmedicare536@gmail.com") {
        const li1 = document.getElementById("liNavLinksUserManagment");
        const li2 = document.getElementById("liNavLinksAddNewUser");
        if (li1) {
            li1.style.display = "block";
            li1.style.pointerEvents = "auto";
            li1.style.opacity = "1";
            li1.style.color = "#000000";
            li1.style.fontWeight = "bold";
        }
        if (li2) {
            li2.style.display = "block";
            li2.style.pointerEvents = "auto";
            li2.style.opacity = "1";
            li2.style.color = "#000000";
            li2.style.fontWeight = "bold";
        }
    }

    let users =
        (user.email === "syriamarketingdata@gmail.com")
            ? emp.filter(o => o.admin === "no")
            : getAllSubordinates(user.email);

    section.innerHTML = '';
    users.forEach(u => {
        const div1 = document.createElement("div");
        div1.className = "section-card";
        div1.innerHTML = `
            <img class="section-icon" style="height:50%;width:50%;position: relative;top:5%;transform: translate(-50%);" src="${u.photo}">
            <h5 class="pg-ad" style="top:6%;">${u.name}</h5>
            <a style="top:14%;" class="btn pg-ad" href="report.html?name=${encodeURIComponent(u.name)}">التقارير</a>
            <a style="top:15%;" class="btn pg-ad" href="inventory.html?name=${encodeURIComponent(u.name)}">الجرد</a>
            <a class="card-link"></a>
        `;
        section.append(div1);
    });
}

// ================== روابط الموظفين ==================
function gmail() {
    const user = getCurrentUser();
    if (!user) return null;
    if (user.admin === "yes") {
        const name = new URLSearchParams(window.location.search).get('name');
        if (!name) return null;
        const target = emp.find(o => o.name === name);
        return target ? target.email : null;
    }
    return user.email;
}

function link(id, i, email) {
    if (window.event) window.event.preventDefault();
    const user = emp.find(o => o.email === email);
    if (!user) {
        goToError('404', 'مستخدم غير موجود', 'لا يمكن العثور على بيانات هذا المستخدم.');
        return;
    }
    const targetLink = user.links && user.links[i] ? user.links[i] : 'error.html';
    if (targetLink !== 'error.html') {
        window.open(targetLink, '_blank');
    } else {
        window.location.href = 'error.html';
    }
}

function redirect(id) {
    if (window.event) window.event.preventDefault();
    const user = getCurrentUser();
    if (!user) { window.location.href = 'index.html'; return; }
    window.location.href = (user.admin === "yes") ? 'admin.html' : 'main.html';
}

// ================== إدارة المستخدمين ==================
function loadManagers() {
    let users = loadUsers();
    let managers = users.filter(u => u.admin === "yes");
    let select = document.getElementById("manager");
    if (!select) return;

    let placeholder = select.getAttribute("data-placeholder") || "— بدون مدير —";
    select.innerHTML = `<option value="">${placeholder}</option>`;

    managers.forEach(m => {
        select.innerHTML += `<option value="${m.email}">${m.name}</option>`;
    });
}

function addLinkField() {
    let container = document.getElementById("links-container");
    if (!container) return;
    let input = document.createElement("input");
    input.type = "text";
    input.className = "link-input";
    input.placeholder = "أدخل رابط…";
    input.style = "margin-bottom:10px; width:100%; padding:10px; border:1px solid #ccc; border-radius:6px;";
    container.appendChild(input);
}

async function addUser() {
    let name = document.getElementById("name").value.trim();
    let email = document.getElementById("email").value.trim().toLowerCase();
    let password = document.getElementById("password").value.trim();
    let manager = document.getElementById("manager").value;
    let role = document.getElementById("role").value;
    let msg = document.getElementById("msg");

    if (!name || !email || !password) {
        msg.textContent = "الرجاء تعبئة جميع الحقول";
        msg.className = "form-message error";
        return;
    }

    let linkInputs = document.querySelectorAll(".link-input");
    let links = [];
    linkInputs.forEach(i => { if (i.value.trim() !== "") links.push(i.value.trim()); });
    if (links.length === 0) links = ["error.html", "error.html", "error.html", "error.html"];

    const newUser = {
        name,
        email,
        password,
        links,
        manager,
        admin: role,
        photo: "images/login-icon.png"
    };

    const result = await api("add", newUser);

    if (result.status === "success") {
        msg.textContent = "تمت إضافة المستخدم بنجاح";
        msg.className = "form-message success";

        await refreshUsers(true);
        loadUsersTable?.();
        window.location.href="admin.html";
    }
}


async function deleteUserByEmail(email) {
    let users = loadUsers();
    let u = users.find(x => x.email === email);
    if (!u) return;
    if (u.admin === "yes") { alert("لا يمكن حذف مدير (Admin) من هذه الصفحة."); return; }
    if (!confirm("هل أنت متأكد من حذف هذا المستخدم؟")) return;

    try {
        const result = await api("delete", {email}   );
        await refreshUsers(true);
         loadUsersTable();
        if (result.status === "success") {
            await refreshUsers(true);
            if (typeof loadUsersTable === 'function') loadUsersTable();
        } else {
            alert("حدث خطأ أثناء الحذف");
        }
    } catch (e) {
        console.error("Delete user error:", e);
        alert("حدث خطأ أثناء الحذف");
    }
}

function getManagerName(email) {
    if (!email) return "-";
    return emp.find(u => u.email === email)?.name || "-";
}

function countValidLinks(links) {
    if (!Array.isArray(links)) return 0;
    return links.filter(l => l && l !== "error.html").length;
}

function loadUsersTable() {
    let users = loadUsers();
    let body = document.getElementById("users-body");
    if (!body) return;
    body.innerHTML = "";

    users.forEach((u) => {
        body.innerHTML += `
            <tr style="border-bottom:1px solid #ddd;">
                <td style="padding:1px;">${u.name}</td>
                <td style="padding:1px;">${u.email}</td>
                <td style="padding:1px;">${getManagerName(u.manager)}</td>
                <td style="padding:1px;">${u.admin === "yes" ? "Admin" : "User"}</td>
                <td style="padding:1px;">${countValidLinks(u.links)}</td>
                <td style="padding:1px;">
                    <button class="btn-secondary" onclick="editUser('${u.email}')">تعديل</button>
                </td>
                <td style="padding:1px;">
                    <button class="btn" style="background:#e74c3c;" onclick="deleteUserByEmail('${u.email}')">حذف</button>
                </td>
            </tr>
        `;
    });
}

// ================== تحميل بيانات مستخدم للتعديل ==================
function loadUserData() {
    let email = localStorage.getItem("editEmail");
    if (!email) return;

    let users = loadUsers();
    let u = users.find(x => x.email === email);
    if (!u) return;

    if (document.getElementById("name")) document.getElementById("name").value = u.name;
    if (document.getElementById("email")) document.getElementById("email").value = u.email;
    if (document.getElementById("password")) document.getElementById("password").value = u.password;

    let container = document.getElementById("links-container");
    if (container) {
        container.innerHTML = "";
        if (Array.isArray(u.links)) {
            u.links.forEach(link => {
                let input = document.createElement("input");
                input.type = "text";
                input.className = "link-input";
                input.value = link;
                input.style = "margin-bottom:10px; width:100%; padding:10px; border:1px solid #ccc; border-radius:6px;";
                container.appendChild(input);
            });
        }
    }

    let managerSelect = document.getElementById("manager");
    if (managerSelect) {
        managerSelect.value = u.manager || "";
    }

    let roleSelect = document.getElementById("role");
    if (roleSelect) {
        roleSelect.value = u.admin || "no";
    }
}

function editUser(email) {
    localStorage.setItem("editEmail", email);
    window.location.href = "edit-user.html";
}

async function updateUser() {
    let emailOriginal = localStorage.getItem("editEmail");
    if (!emailOriginal) return;

    let name = document.getElementById("name").value.trim();
    let email = document.getElementById("email").value.trim().toLowerCase();
    let password = document.getElementById("password").value.trim();
    let manager = document.getElementById("manager").value;
    let role = document.getElementById("role").value;
    let msg = document.getElementById("msg");

    let linkInputs = document.querySelectorAll(".link-input");
    let links = [];
    linkInputs.forEach(i => { if (i.value.trim() !== "") links.push(i.value.trim()); });

    const updatedUser = {
        oldEmail: emailOriginal,
        name,
        email,
        password,
        links,
        manager,
        admin: role,
        photo: "images/login-icon.png"
    };

    const result = await api("update", updatedUser);

    if (result.status === "success") {
        msg.textContent = "تم تحديث المستخدم بنجاح";
        msg.className = "form-message success";

        await refreshUsers(true);
        loadUsersTable?.();

        setTimeout(() => {
            window.location.href = "users.html";
        }, 500);
    }
}


// ================== صفحة الخطأ ==================
function initErrorPage() {
    const params = new URLSearchParams(window.location.search);
    const errorCode = params.get('code') || 'خطأ';
    const errorTitle = params.get('title') || 'حدث خطأ ما';
    const errorDescription = params.get('desc') || 'نأسف، لقد واجهنا مشكلة غير متوقعة.';

    const c = document.getElementById('error-code');
    const t = document.getElementById('error-title');
    const d = document.getElementById('error-description');

    if (c) c.textContent = errorCode;
    if (t) t.textContent = decodeURIComponent(errorTitle);
    if (d) d.textContent = decodeURIComponent(errorDescription);
}

// ================== تشغيل النظام ==================
document.addEventListener('DOMContentLoaded', async () => {
    setCurrentYear();
    await refreshUsers();
    initLoginPage();
    await initProtectedPages();
});

function searchUsers() {
    const q = document.getElementById("search").value.trim().toLowerCase();
    const body = document.getElementById("users-body");

    body.innerHTML = "";

    emp.filter(u =>
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.manager && u.manager.toLowerCase().includes(q))
    ).forEach(u => {
        body.innerHTML += `
            <tr>
                <td>${u.name}</td>
                <td>${u.email}</td>
                <td>${getManagerName(u.manager)}</td>
                <td>${u.admin === "yes" ? "Admin" : "User"}</td>
                <td>${countValidLinks(u.links)}</td>
                <td><button onclick="editUser('${u.email}')">تعديل</button></td>
                <td><button onclick="deleteUserByEmail('${u.email}')">حذف</button></td>
            </tr>
        `;
    });
}

function getAllSubordinates(managerEmail) {
    let result = [];

    function collect(email) {
        const subs = emp.filter(u => u.manager === email);
        subs.forEach(s => {
            result.push(s);
            collect(s.email); // recursion
        });
    }

    collect(managerEmail);
    return result;
}


// ==============================================================
// Recetario By GuzzBarman – Admin Auth Edition (Corregido)
// ==============================================================

import {
  collection,
  addDoc,
  onSnapshot,
  getDoc,
  doc,
  serverTimestamp,
  query,
  where
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-firestore.js';

import {
  ref,
  uploadBytesResumable,
  getDownloadURL
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-storage.js';

import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut
} from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-auth.js';

import { initializeApp, deleteApp } from 'https://www.gstatic.com/firebasejs/10.12.3/firebase-app.js';

const db = window.db;
const storage = window.storage;
const auth = window.auth;
let currentUser = null;
let allCocktails = [];
let debounceTimer;

const ADMIN_EMAIL = "admin@admin.com";

// ===== DOM elements =====
const emailInput = document.getElementById('emailInput');
const passwordInput = document.getElementById('passwordInput');
const authForm = document.getElementById('authForm');
const loginEmailBtn = document.getElementById('loginEmailBtn');
const registerBtn = document.getElementById('registerBtn');
const logoutBtn = document.getElementById('logoutBtn');
const userName = document.getElementById('userName');
const recetarioNombre = document.getElementById('recetarioNombre');
const yearSpan = document.getElementById('year');
if (yearSpan) yearSpan.textContent = new Date().getFullYear();

// ===== Eventos de login/registro =====
authForm.addEventListener('submit', async e => {
  e.preventDefault();
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();

  try {
    const result = await signInWithEmailAndPassword(auth, email, password);
    currentUser = result.user;
    window.currentUser = currentUser;
    authForm.reset();
  } catch (err) {
    alert('Usuario o contraseña incorrectos.');
    console.error(err);
  }
});

registerBtn.addEventListener('click', async () => {
  const email = emailInput.value.trim();
  const password = passwordInput.value.trim();
  const nombre = recetarioNombre.value.trim();

  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    currentUser = result.user;

    await addDoc(collection(db, 'users'), {
      uid: currentUser.uid,
      email,
      nombre
    });

    authForm.reset();
  } catch (err) {
    alert('Error al registrar usuario. ¿Ya existe?');
    console.error(err);
  }
});

logoutBtn.addEventListener('click', async () => {
  await signOut(auth);
  currentUser = null;
});

// ===== Control de sesión =====
onAuthStateChanged(auth, async user => {
  currentUser = user;

  if (user) {
    try {
      const perfilDoc = await getDoc(doc(db, 'users', user.uid));
      if (perfilDoc.exists()) {
        const perfil = perfilDoc.data();
        document.querySelector("header h1").textContent = `Recetario de ${perfil.nombre}`;
      } else {
        const emailName = user.email.split("@")[0];
        document.querySelector("header h1").textContent = `Recetario de ${emailName}`;
      }
    } catch (err) {
      console.error('Error obteniendo perfil:', err);
    }

    authForm.style.display = 'none';
    logoutBtn.style.display = 'inline-block';
    userName.textContent = `👤 ${user.email}`;

    const fab = document.getElementById('fab');
    if (fab) fab.style.display = 'block';
    const modal = document.getElementById('formModal');
    const cancel = document.getElementById('cancelBtn');

    if (fab && modal && cancel) {
      fab.addEventListener('click', () => modal.classList.add('show'));
      cancel.addEventListener('click', () => modal.classList.remove('show'));
      window.addEventListener('click', e => {
        if (e.target === modal) modal.classList.remove('show');
      });
    }

    const adminBtn = document.getElementById('openAdminRegister');
    if (user.email === ADMIN_EMAIL) {
      registerBtn.style.display = 'inline-block';
      recetarioNombre.style.display = 'inline-block';
      if (adminBtn) adminBtn.style.display = 'inline-block';
    } else {
      registerBtn.style.display = 'none';
      recetarioNombre.style.display = 'none';
      if (adminBtn) adminBtn.style.display = 'none';
    }

    const cocktailsQuery = query(
      collection(db, 'cocktails'),
      where('uid', '==', user.uid)
    );

    onSnapshot(cocktailsQuery, snap => {
      allCocktails = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      displayCocktails();
    });
  } else {
    allCocktails = [];
    displayCocktails();
    userName.textContent = '';
    const fab = document.getElementById('fab');
    if (fab) fab.style.display = 'none';
    authForm.style.display = 'flex';
    logoutBtn.style.display = 'none';
    registerBtn.style.display = 'none';
    recetarioNombre.style.display = 'none';
    const adminBtn = document.getElementById('openAdminRegister');
    if (adminBtn) adminBtn.style.display = 'none';
  }
});

// ===== Envío de nueva receta =====
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('addCocktailForm');
  if (!form) return console.warn("Formulario de cóctel no encontrado");

  form.addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentUser) return alert("Debes iniciar sesión para agregar una receta");

    console.log("🔄 Enviando receta...");

    const fd = new FormData(form);
    const file = fd.get('imageFile');

    if (!file || !file.type.startsWith('image/')) {
      return alert('Por favor selecciona una imagen válida');
    }

    const storageRef = ref(storage, `cocktails/${Date.now()}_${file.name}`);
    const progressBar = document.getElementById('uploadProgress');
    progressBar.style.display = 'block';
    progressBar.value = 0;

    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      snap => {
        const percent = Math.round((snap.bytesTransferred / snap.totalBytes) * 100);
        progressBar.value = percent;
      },
      err => {
        console.error('Error subiendo imagen:', err);
        alert('Error al subir imagen');
      },
      async () => {
        const url = await getDownloadURL(uploadTask.snapshot.ref);
        progressBar.style.display = 'none';

        try {
          await addDoc(collection(db, 'cocktails'), {
            uid: currentUser.uid,
            name: fd.get('name'),
            category: fd.get('category'),
            image: url,
            recipe: {
              ingredients: fd.get('ingredients').split('\n').filter(Boolean),
              glass: fd.get('glass'),
              ice: fd.get('ice'),
              method: fd.get('method'),
              garnish: fd.get('garnish')
            },
            createdAt: serverTimestamp()
          });

          console.log("✅ Receta guardada con éxito");
          form.reset();
          document.getElementById('formModal').classList.remove('show');
        } catch (error) {
          console.error("🧨 Error guardando en Firestore:", error);
          alert("Error al guardar la receta");
        }
      }
    );
  });
});

// ===== Mostrar recetas =====
function displayCocktails(filter = '') {
  const container = document.getElementById('cocktailContainer');
  container.innerHTML = '';

  const categories = [...new Set(allCocktails.map(c => c.category))].sort();

  categories.forEach(cat => {
    const items = allCocktails
      .filter(c =>
        c.category === cat &&
        c.name.toLowerCase().includes(filter.toLowerCase())
      )
      .sort((a, b) => a.name.localeCompare(b.name));

    if (!items.length) return;

    const section = document.createElement('section');
    section.className = 'category';
    section.innerHTML = `<h2>${cat}</h2><div class="cocktail-list"></div>`;
    items.forEach(c => section.querySelector('.cocktail-list').appendChild(createCard(c)));
    container.appendChild(section);
  });
}

function createCard(c) {
  const card = document.createElement('div');
  card.className = 'cocktail-card';
  card.innerHTML = `
    <img src="${c.image}" alt="${c.name}">
    <div class="cocktail-content">
      <h3>${c.name}</h3>
      <div class="cocktail-recipe">
        <h4>Receta</h4>
        <ul>${c.recipe.ingredients.map(i => `<li>${i}</li>`).join('')}</ul>
        <p><strong>Vaso:</strong> ${c.recipe.glass}</p>
        <p><strong>Hielo:</strong> ${c.recipe.ice}</p>
        <p><strong>Método:</strong> ${c.recipe.method}</p>
        <p><strong>Decoración:</strong> ${c.recipe.garnish}</p>
      </div>
    </div>
  `;
  card.addEventListener('click', () => card.classList.toggle('active'));
  return card;
}

function filterCocktails() {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    displayCocktails(document.getElementById('searchInput').value.trim());
  }, 300);
}

window.filterCocktails = filterCocktails;

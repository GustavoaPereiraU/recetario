// ==============================
// APP DE RECETARIO DE CÓCTELES
// ==============================

// Variables globales
let currentUser = null;
let allRecipes = [];

// Inicializar cuando el DOM esté listo
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    loadRecipes();
});

/**
 * Asigna listeners a formularios, búsqueda y clics fuera de modales
 */
function setupEventListeners() {
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('recipeForm').addEventListener('submit', handleRecipeSubmit);
    document.getElementById('userForm').addEventListener('submit', handleUserRegistration);
    document.getElementById('searchInput').addEventListener('input', filterRecipes);

    // Cierra modal al hacer clic fuera del contenido
    document.querySelectorAll('.modal').forEach(modal => {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal(modal.id);
        });
    });
}

/**
 * Inicia sesión con usuario de Firebase Firestore
 */
async function handleLogin(e) {
    e.preventDefault();

    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;

    try {
        const userDoc = await db.collection('users').doc(username).get();
        if (!userDoc.exists) return alert('Usuario no encontrado');

        const userData = userDoc.data();
        if (userData.password !== password) return alert('Contraseña incorrecta');

        currentUser = {
            uid: username,
            username,
            recipeName: userData.recipeName,
            isAdmin: username === 'admin'
        };

        updateUI();
        closeModal('loginModal');
        loadRecipes();
    } catch (err) {
        console.error('Error al iniciar sesión:', err);
        alert('Error al iniciar sesión');
    }
}

/**
 * Registrar usuario (solo administrador)
 */
async function handleUserRegistration(e) {
    e.preventDefault();
    if (!currentUser?.isAdmin) return alert('Solo el administrador puede registrar usuarios');

    const username = document.getElementById('newUsername').value.trim();
    const password = document.getElementById('newPassword').value;
    const recipeName = document.getElementById('recipeBookName').value;

    try {
        const userDoc = await db.collection('users').doc(username).get();
        if (userDoc.exists) return alert('El nombre de usuario ya existe');

        await db.collection('users').doc(username).set({
            password,
            recipeName,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert('Usuario registrado exitosamente');
        closeModal('userModal');
        document.getElementById('userForm').reset();
    } catch (err) {
        console.error('Error al registrar usuario:', err);
        alert('Error al registrar usuario');
    }
}

/**
 * Cierra sesión
 */
function logout() {
    currentUser = null;
    updateUI();
    loadRecipes();
}

/**
 * Actualiza la interfaz según el usuario actual
 */
function updateUI() {
    const authButtons = document.getElementById('authButtons');
    const userSection = document.getElementById('userSection');
    const userInfo = document.getElementById('userInfo');
    const headerTitle = document.getElementById('headerTitle');
    const addRecipeSection = document.getElementById('addRecipeSection');
    const adminSection = document.getElementById('adminSection');

    if (currentUser) {
        authButtons.style.display = 'none';
        userSection.style.display = 'flex';
        userInfo.textContent = `Bienvenido, ${currentUser.username}`;
        headerTitle.textContent = currentUser.recipeName;
        addRecipeSection.style.display = 'block';
        adminSection.style.display = currentUser.isAdmin ? 'block' : 'none';
    } else {
        authButtons.style.display = 'block';
        userSection.style.display = 'none';
        headerTitle.textContent = 'Recetario de Cócteles';
        addRecipeSection.style.display = 'none';
        adminSection.style.display = 'none';
    }
}

/**
 * Agrega una receta nueva
 */
async function handleRecipeSubmit(e) {
    e.preventDefault();
    if (!currentUser) return alert('Debes iniciar sesión para agregar recetas');

    const name = document.getElementById('recipeName').value;
    const imageFile = document.getElementById('recipeImage').files[0];
    const ingredients = document.getElementById('recipeIngredients').value.split('\n').filter(i => i.trim());
    const glass = document.getElementById('recipeGlass').value;
    const ice = document.getElementById('recipeIce').value;
    const method = document.getElementById('recipeMethod').value;
    const garnish = document.getElementById('recipeGarnish').value;
    const isPublic = document.getElementById('recipePublic').checked;

    try {
        let imageUrl = '';
        if (imageFile) {
            const imageRef = storage.ref(`recipes/${Date.now()}_${imageFile.name}`);
            const uploadTask = await imageRef.put(imageFile);
            imageUrl = await uploadTask.ref.getDownloadURL();
        }

        await db.collection('cocktails').add({
            name,
            image: imageUrl,
            ingredients,
            glass,
            ice,
            method,
            garnish,
            public: isPublic && currentUser.isAdmin,
            uid: currentUser.isAdmin && isPublic ? 'public' : currentUser.uid,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
        });

        alert('Receta guardada exitosamente');
        closeModal('recipeModal');
        document.getElementById('recipeForm').reset();
        loadRecipes();
    } catch (err) {
        console.error('Error al guardar receta:', err);
        alert('Error al guardar receta');
    }
}

/**
 * Cargar recetas (públicas o del usuario)
 */
async function loadRecipes() {
    try {
        let query = db.collection('cocktails');
        if (currentUser) {
            query = query.where('uid', 'in', [currentUser.uid, 'public']);
        } else {
            query = query.where('public', '==', true);
        }

        const snapshot = await query.get();
        allRecipes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        displayRecipes(allRecipes);
    } catch (err) {
        console.error('Error al cargar recetas:', err);
    }
}

/**
 * Muestra las recetas en el grid
 */
function displayRecipes(recipes) {
    const recipeGrid = document.getElementById('recipeGrid');
    if (recipes.length === 0) {
        recipeGrid.innerHTML = `
            <div class="no-recipes">
                <h3>No hay recetas disponibles</h3>
                <p>${currentUser ? 'Agrega tu primera receta para comenzar.' : 'Inicia sesión para ver recetas.'}</p>
            </div>`;
        return;
    }

    recipeGrid.innerHTML = recipes.map(recipe => `
        <div class="recipe-card" onclick="toggleRecipeDetails('${recipe.id}')">
            <img src="${recipe.image || 'https://via.placeholder.com/350x200/333/fff?text=Sin+Imagen'}" alt="${recipe.name}" class="recipe-image">
            <div class="recipe-info">
                <h3 class="recipe-title">${recipe.name}</h3>
                <p class="recipe-preview">Vaso: ${recipe.glass} | Hielo: ${recipe.ice}</p>
            </div>
            <div class="recipe-details" id="details-${recipe.id}">
                <div class="recipe-section">
                    <h4>Ingredientes</h4>
                    <ul>${recipe.ingredients.map(ing => `<li>${ing}</li>`).join('')}</ul>
                </div>
                <div class="recipe-section"><h4>Método</h4><p>${recipe.method}</p></div>
                <div class="recipe-section"><h4>Decoración</h4><p>${recipe.garnish}</p></div>
            </div>
        </div>`).join('');
}

// Alternar detalles
function toggleRecipeDetails(recipeId) {
    document.getElementById(`details-${recipeId}`).classList.toggle('active');
}

// Filtrar por búsqueda
function filterRecipes() {
    const term = document.getElementById('searchInput').value.toLowerCase();
    const filtered = allRecipes.filter(r => r.name.toLowerCase().includes(term));
    displayRecipes(filtered);
}

// Modales
function openLoginModal() { document.getElementById('loginModal').classList.add('active'); }
function openRecipeModal() { document.getElementById('recipeModal').classList.add('active'); }
function openUserModal() { document.getElementById('userModal').classList.add('active'); }
function closeModal(id) { document.getElementById(id).classList.remove('active'); }

/**
 * Crea 5 recetas públicas de ejemplo (solo el admin puede usarlo)
 */
async function crearRecetasEjemplo() {
    if (!currentUser?.isAdmin) {
        alert('Solo el administrador puede cargar recetas públicas');
        return;
    }

    const recetas = [
        {
            name: 'Mojito Clásico',
            ingredients: ['60ml Ron Blanco', '30ml Jugo de lima', 'Hierbabuena', '2 cucharaditas de azúcar', 'Agua con gas'],
            glass: 'Vaso largo',
            ice: 'Con hielo picado',
            method: 'Macerar hierbabuena con azúcar y lima, añadir ron, hielo y completar con agua con gas.',
            garnish: 'Rama de hierbabuena',
        },
        {
            name: 'Negroni',
            ingredients: ['30ml Gin', '30ml Vermut rojo', '30ml Campari'],
            glass: 'Old Fashioned',
            ice: 'Con hielo en cubos',
            method: 'Remover todos los ingredientes con hielo y servir.',
            garnish: 'Twist de naranja',
        },
        {
            name: 'Piña Colada',
            ingredients: ['60ml Ron blanco', '90ml Jugo de piña', '30ml Crema de coco'],
            glass: 'Copa Huracán',
            ice: 'Con hielo triturado',
            method: 'Licuar todos los ingredientes con hielo.',
            garnish: 'Rodaja de piña y cereza',
        },
        {
            name: 'Cosmopolitan',
            ingredients: ['45ml Vodka', '15ml Triple Sec', '15ml Jugo de lima', '30ml Jugo de arándano'],
            glass: 'Copa cocktail',
            ice: 'Sin hielo',
            method: 'Agitar con hielo y colar.',
            garnish: 'Twist de lima',
        },
        {
            name: 'Whiskey Sour',
            ingredients: ['60ml Bourbon', '30ml Jugo de limón', '15ml Jarabe simple', '1 clara de huevo (opcional)'],
            glass: 'Old Fashioned',
            ice: 'Con hielo en cubos',
            method: 'Agitar en seco, luego con hielo y colar.',
            garnish: 'Rodaja de limón o cereza',
        }
    ];

    try {
        const batch = db.batch();

        recetas.forEach(receta => {
            const docRef = db.collection('cocktails').doc();
            batch.set(docRef, {
                ...receta,
                image: '', // Puedes poner una URL real si lo deseas
                public: true,
                uid: 'public',
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
        });

        await batch.commit();
        alert('Recetas públicas creadas exitosamente.');
        loadRecipes();
    } catch (err) {
        console.error('Error al crear recetas públicas:', err);
        alert('Hubo un error al cargar las recetas.');
    }
}

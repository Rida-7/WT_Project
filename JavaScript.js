// Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAozos3m8SXmDIu754Ji-PdUoGsu6KQj_c",
    authDomain: "book-store-f12c0.firebaseapp.com",
    projectId: "book-store-f12c0",
    storageBucket: "book-store-f12c0.firebasestorage.app",
    messagingSenderId: "243900854012",
    appId: "1:243900854012:web:7ee83e1908a6e2b9b13179"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Get Firebase Auth reference
const auth = firebase.auth();

// Google Sign-In Function
async function handleGoogleSignIn() {
    const provider = new firebase.auth.GoogleAuthProvider();

    try {
        const result = await auth.signInWithPopup(provider);
        const user = result.user;
        const email = user._delegate.email;
        console.log("User authenticated via Google:", email);

        const response = await fetch('http://localhost:8082/check-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: user.email })
        });

        const responseData = await response.json();
        if (responseData.exists) {
            alert(`Welcome back, ${user.displayName}!`);
            window.location.href = '/home';
        } else {
            showRoleSelectionModal(user);
        }
    } catch (error) {
        console.error("Error during Google Sign-In:", error);
        alert(`Authentication failed: ${error.message}`);
    }
}

function showRoleSelectionModal(user) {
    const loginModal = document.getElementById('loginSignupModal');
    const roleSelectionModal = document.getElementById('roleSelectionModal');

    if (loginModal) loginModal.style.display = 'none';
    if (roleSelectionModal) roleSelectionModal.style.display = 'block';

    // Attach event listener to dynamically handle role-specific fields
    document.getElementById('googleRole').addEventListener('change', toggleGoogleField);

    // Handle form submission
    document.getElementById('roleSelectionForm').onsubmit = async function (e) {
        e.preventDefault();

        const role = document.getElementById('googleRole').value;
        const formData = new FormData(); // FormData for handling file uploads

        formData.append('fullname', user.displayName);
        formData.append('email', user.email);
        formData.append('role', role);
        formData.append('password', user.uid);

        if (role === 'publisher') {
            const storeName = document.getElementById('googleStoreName').value;
            const addressP = document.getElementById('googleAddressP').value;
            const contactP = document.getElementById('googleContactP').value;
            const legalDoc = document.getElementById('googleLegalDoc').files[0]; // Get uploaded file

            if (!storeName || !addressP || !contactP || !legalDoc) {
                alert('Please provide all required fields for publisher registration.');
                return;
            }

            // Add publisher fields to FormData
            formData.append('storeName', storeName);
            formData.append('addressP', addressP);
            formData.append('contactP', contactP);
            formData.append('legalDoc', legalDoc); // Append the file
        } else if (role === 'customer') {
            const addressC = document.getElementById('googleAddressC').value;
            const contactC = document.getElementById('googleContactC').value;

            // Add customer fields to FormData
            formData.append('addressC', addressC);
            formData.append('contactC', contactC);
        }

        try {
            const signupResponse = await fetch('http://localhost:8082/signup', {
                method: 'POST',
                body: formData // Send FormData instead of JSON
            });

            if (signupResponse.ok) {
                alert('Account created successfully!');
                roleSelectionModal.style.display = 'none';
                window.location.href = '/index.html';
            } else {
                const errorData = await signupResponse.json();
                alert(`Error: ${errorData.error}`);
            }
        } catch (error) {
            console.error("Error during Google Sign-Up:", error);
        }
    };
}


function closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
        modal.style.display = 'none';
    }
}

// Forgot Password Modal Handling
function openForgotPasswordModal() {

    $('#loginSignupModal').modal('hide'); // Close the login modal
    // Show the Reset Password Modal        
    $('#resetPasswordModal').modal('show');

}

// Handle Reset Password Form Submission
document.getElementById('resetPasswordForm').addEventListener('submit', function (event) {
    event.preventDefault();

    const email = document.getElementById('resetPasswordEmail').value;
    const newPassword = document.getElementById('newPassword').value;
    const confirmPassword = document.getElementById('confirmPassword').value;

    // Check if passwords match
    if (newPassword !== confirmPassword) {
        alert('Passwords do not match.');
        return;
    }

    // Send the email and new password to the server
    fetch('http://localhost:8082/reset-password', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ email, newPassword })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Password successfully reset!');
                $('#resetPasswordModal').modal('hide');
            } else {
                alert('Error: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error:', error);
        });
});

// Traditional Login Handling
document.getElementById('loginForm').addEventListener('submit', async function (event) {
    event.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    const response = await fetch('http://localhost:8082/signin', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
    });

    if (response.ok) {
        const data = await response.json();
        localStorage.setItem('jwtToken', data.token);
        console.log('Token saved to localStorage:', data.token);
        // Redirect user based on their role
        switch (data.role) {
            case 'admin':
                window.location.href = '/admin.html'; // Redirect to admin dashboard
                break;
            case 'publisher':
                window.location.href = '/publisher.html'; // Redirect to publisher dashboard
                break;
            case 'customer':
                window.location.href = '/index.html'; // Redirect to customer dashboard
                break;
            default:
                window.location.href = '/index.html'; // Default dashboard redirection
        }
    } else {
        const errorData = await response.json();
        alert(errorData.error);
    }
});

document.getElementById('signupForm').addEventListener('submit', async function (event) {
    event.preventDefault();

    // Create a FormData object
    const formData = new FormData();
    formData.append('fullname', document.getElementById('signupfullname').value);
    formData.append('email', document.getElementById('signupEmail').value);
    formData.append('password', document.getElementById('signupPassword').value);
    formData.append('role', document.getElementById('signupRole').value);

    // Add publisher-specific fields
    if (document.getElementById('signupRole').value === 'publisher') {
        formData.append('storeName', document.getElementById('storeName').value);
        formData.append('addressP', document.getElementById('addressP').value);
        formData.append('contactP', document.getElementById('contactP').value);

        const legalDoc = document.getElementById('legalDoc').files[0]; // Access the selected file
        if (!legalDoc) {
            alert('Please upload the legal document.');
            return;
        }
        formData.append('legalDoc', legalDoc); // Append the file
    }

    // Add customer-specific fields
    if (document.getElementById('signupRole').value === 'customer') {
        const addressC = document.getElementById('addressC') ? document.getElementById('addressC').value : '';
        const contactC = document.getElementById('contactC') ? document.getElementById('contactC').value : '';
        formData.append('address', addressC);
        formData.append('contact', contactC);
    }

    try {
        // Check if user already exists
        const checkUserResponse = await fetch('http://localhost:8082/check-user', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: document.getElementById('signupEmail').value })
        });

        const checkUserData = await checkUserResponse.json();
        if (checkUserData.exists) {
            alert('User already exists. Please login instead.');
            return;
        }

        // Proceed with sign-up
        const signupResponse = await fetch('http://localhost:8082/signup', {
            method: 'POST',
            body: formData // Send the FormData object
        });

        const result = await signupResponse.json();
        if (signupResponse.ok) {
            alert(result.message);
            $('#loginSignupModal').modal('hide'); // Close modal after signup
        } else {
            alert(result.error);
        }
    } catch (error) {
        console.error('Error during signup:', error);
        alert('An error occurred. Please try again.');
    }
});


// Dynamic Store Name Field 
function togglehiddenField() {
    const roleSelect = document.getElementById('signupRole');
    const publisherField = document.getElementById('publisherField'); // Publisher fields
    const customerField = document.getElementById('customerField'); // Customer fields

    // Publisher-specific inputs
    const storeNameInput = document.getElementById('storeName');
    const addressPInput = document.getElementById('addressP');
    const contactPInput = document.getElementById('contactP');
    const legalDocInput = document.getElementById('legalDoc');

    // Customer-specific inputs
    const addressCInput = document.getElementById('addressC');
    const contactCInput = document.getElementById('contactC');

    // Handle role selection
    if (roleSelect.value === 'publisher') {
        // Show publisher-specific fields
        publisherField.style.display = 'block';
        customerField.style.display = 'none';

        // Set required for publisher fields
        storeNameInput.setAttribute('required', 'true');
        addressPInput.setAttribute('required', 'true');
        contactPInput.setAttribute('required', 'true');
        legalDocInput.setAttribute('required', 'true');

        // Remove required from customer fields
        addressCInput.removeAttribute('required');
        contactCInput.removeAttribute('required');
    } else if (roleSelect.value === 'customer') {
        // Show customer-specific fields
        publisherField.style.display = 'none';
        customerField.style.display = 'block';

        // Set optional for customer fields
        addressCInput.removeAttribute('required');
        contactCInput.removeAttribute('required');

        // Remove required from publisher fields
        storeNameInput.removeAttribute('required');
        addressPInput.removeAttribute('required');
        contactPInput.removeAttribute('required');
        legalDocInput.removeAttribute('required');
    } else {
        // Hide all dynamic fields for other roles
        publisherField.style.display = 'none';
        customerField.style.display = 'none';

        // Remove required from all dynamic fields
        storeNameInput.removeAttribute('required');
        addressPInput.removeAttribute('required');
        contactPInput.removeAttribute('required');
        legalDocInput.removeAttribute('required');
        addressCInput.removeAttribute('required');
        contactCInput.removeAttribute('required');
    }
}

// Dynamic Store Name Field 
function toggleGoogleField() {
    const roleSelect = document.getElementById('googleRole');
    const publisherField = document.getElementById('googlePublisherField'); // Publisher fields
    const customerField = document.getElementById('googleCustomerField'); // Customer fields

    // Publisher-specific inputs
    const storeNameInput = document.getElementById('googleStoreName');
    const addressPInput = document.getElementById('googleAddressP');
    const contactPInput = document.getElementById('googleContactP');
    const legalDocInput = document.getElementById('googleLegalDoc');

    // Customer-specific inputs
    const addressCInput = document.getElementById('googleAddressC');
    const contactCInput = document.getElementById('googleContactC');

    // Handle role selection
    if (roleSelect.value === 'publisher') {
        // Show publisher-specific fields
        publisherField.style.display = 'block';
        customerField.style.display = 'none';

        // Set required for publisher fields
        storeNameInput.setAttribute('required', 'true');
        addressPInput.setAttribute('required', 'true');
        contactPInput.setAttribute('required', 'true');
        legalDocInput.setAttribute('required', 'true');

        // Remove required from customer fields
        addressCInput.removeAttribute('required');
        contactCInput.removeAttribute('required');
    } else if (roleSelect.value === 'customer') {
        // Show customer-specific fields
        publisherField.style.display = 'none';
        customerField.style.display = 'block';

        // Set optional for customer fields
        addressCInput.removeAttribute('required');
        contactCInput.removeAttribute('required');

        // Remove required from publisher fields
        storeNameInput.removeAttribute('required');
        addressPInput.removeAttribute('required');
        contactPInput.removeAttribute('required');
        legalDocInput.removeAttribute('required');
    } else {
        // Hide all dynamic fields for other roles
        publisherField.style.display = 'none';
        customerField.style.display = 'none';

        // Remove required from all dynamic fields
        storeNameInput.removeAttribute('required');
        addressPInput.removeAttribute('required');
        contactPInput.removeAttribute('required');
        legalDocInput.removeAttribute('required');
        addressCInput.removeAttribute('required');
        contactCInput.removeAttribute('required');
    }
}

// Function to fetch user role from the backend
function fetchUserRole(token) {
    return fetch('http://localhost:8082/get-user-role', {
        method: 'GET',
        headers: {
            'Authorization': `Bearer ${token}`
        }
    })
        .then(response => {
            if (!response.ok) {
                throw new Error(`Server responded with status ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data && data.role) {
                return data.role;
            }
            throw new Error('Unable to fetch user role');
        });
}

// Function to fetch cart data
function fetchCartData(token) {
    console.log('Retrieving Cart Data with Token:', token);

    fetch('http://localhost:8082/get-cart', {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json',
        }
    })
        .then(response => {
            console.log("Fetch API Response Status:", response.status);
            if (!response.ok) {
                throw new Error(`Server responded with status ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            console.log('Fetched Cart Data:', data);
            if (data && Array.isArray(data.cartItems) && data.cartItems.length > 0) {
                displayCartItems(data.cartItems);
            } else {
                alert("Your cart is empty");
                const checkoutButton = document.getElementById("checkout-button");
                if (checkoutButton) {
                    checkoutButton.style.display = "none";
                }
            }
        })
        .catch(error => {
            console.error('Error fetching cart data:', error);
            alert(`Error fetching cart data: ${error.message}`);
        });
}



// Function to display an empty cart message
function displayCartItems(cartItems) {
    const cartContent = document.getElementById("cart-content");
    cartContent.innerHTML = '';  // Clear cart content first

    let totalAmount = 0; // Initialize total amount

    cartItems.forEach(item => {
        totalAmount += item.price * item.quantity; // Calculate total for each item

        const cartItemElement = document.createElement('div');
        cartItemElement.classList.add('cart-item');

        cartItemElement.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 15px;">
            <img src="${item.cover_image}" alt="${item.title}" style="width: 50px; height: 75px; margin-right: 10px; object-fit: cover;">
            <div style="flex-grow: 1;">
                <p><strong>${item.title}</strong> by ${item.author}</p>
                <p>Publisher: <em>${item.publisher_name}</em></p>
                <p>Price: Rs. ${item.price}</p>
                <div style="display: flex; align-items: center;">
                    <button class="decrease-quantity" data-item-id="${item.cart_item_id}" style="background: #f39c12; color: white; border: none; padding: 5px 10px; cursor: pointer;">-</button>
                    <span style="margin: 0 10px;">${item.quantity}</span>
                    <button class="increase-quantity" data-item-id="${item.cart_item_id}" style="background: #2ecc71; color: white; border: none; padding: 5px 10px; cursor: pointer;">+</button>
                </div>
            </div>
            <button class="remove-item" data-item-id="${item.cart_item_id}" style="background: #e74c3c; color: white; border: none; padding: 5px 10px; cursor: pointer;">Remove</button>
        </div>
    `;

        cartContent.appendChild(cartItemElement);

        // Add event listener to the remove button
        cartItemElement.querySelector('.remove-item').addEventListener('click', function () {
            removeCartItem(item.cart_item_id);
        });

        // Add event listener to the increase button
        cartItemElement.querySelector('.increase-quantity').addEventListener('click', function () {
            updateCartItemQuantity(item.cart_item_id, item.quantity + 1);
        });

        // Add event listener to the decrease button
        cartItemElement.querySelector('.decrease-quantity').addEventListener('click', function () {
            if (item.quantity > 1) { // Prevent decreasing below 1
                updateCartItemQuantity(item.cart_item_id, item.quantity - 1);
            }
        });
    });

    // Display the total amount at the bottom
    const totalAmountElement = document.createElement('div');
    totalAmountElement.style = "margin-top: 20px; font-weight: bold; text-align: right;";
    totalAmountElement.innerHTML = `Total Amount: Rs. ${totalAmount}`;
    cartContent.appendChild(totalAmountElement);

    // Display the checkout button (ensure it's always visible)
    let checkoutButton = document.getElementById("checkout-button");

    if (!checkoutButton) {
        checkoutButton = document.createElement('button');
        checkoutButton.setAttribute('id', 'checkout-button');
        checkoutButton.setAttribute('type', 'button');
        checkoutButton.classList.add('cuustom-btn', 'cuustom-btn-primary');
        cartContent.appendChild(checkoutButton);
    }

    checkoutButton.textContent = 'Proceed to Checkout';
    checkoutButton.style = "margin-top: 20px; width: 100%; padding: 10px; background: #2ecc71; color: white; border: none; cursor: pointer;";
    checkoutButton.addEventListener('click', () => {
        // Save cart data and total amount to localStorage
        localStorage.setItem('cartItems', JSON.stringify(cartItems));
        localStorage.setItem('totalAmount', totalAmount);
        // Redirect to the checkout details page
        window.location.href = '/checkout.html';
    });

    // Display the modal
    document.getElementById("cartModal").style.display = "block";
}


function updateCartItemQuantity(cartItemId, newQuantity) {
    const token = localStorage.getItem("jwtToken");

    // Check if the user is logged in
    if (!token) {
        alert("Please log in to view items in your cart.");
        return;
    }

    // Make API request to update the cart item
    fetch(`http://localhost:8082/cart/update`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`  // Add token to headers for authentication
        },
        body: JSON.stringify({
            cart_item_id: cartItemId,
            quantity: newQuantity
        })
    })
        .then(response => {
            console.log("Update API Response Status:", response.status);
            if (!response.ok) {
                throw new Error('Failed to update cart item');
            }
            return response.json();
        })
        .then(data => {
            console.log('Update API Response Data:', data);
            if (data.success) {
                // Refresh cart data to reflect the updated quantity
                fetchCartData(token);
            } else {
                alert('Error updating cart item: ' + data.message);
            }
        })
        .catch(error => {
            console.error('Error updating cart item:', error);
        });
}

// Function to remove item from cart
function removeCartItem(itemId) {
    const token = localStorage.getItem("jwtToken");
    if (!token) {
        alert("Please log in to remove items from your cart.");
        return;
    }

    fetch('http://localhost:8082/remove-item', {
        method: 'DELETE',
        headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ itemId })
    })
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                alert('Item removed from cart');
                fetchCartData(token);
            } else {
                alert('Failed to remove item from cart');
            }
        })
        .catch(error => {
            console.error('Error removing item:', error);
        });
}

// Function to check login status and handle user role
function checkLoginStatus() {
    const token = localStorage.getItem("jwtToken");

    if (token) {
        fetchUserRole(token)
            .then(role => {
                if (role === 'customer') {
                    document.getElementById("customer-links").style.display = "block";
                    document.getElementById("auth-links").style.display = "none";
                } else {
                    document.getElementById("customer-links").style.display = "none";
                    document.getElementById("auth-links").style.display = "block";
                }
            })
            .catch(error => {
                console.error('Error fetching user role:', error);
                document.getElementById("customer-links").style.display = "none";
                document.getElementById("auth-links").style.display = "block";
            });
    } else {
        document.getElementById("customer-links").style.display = "none";
        document.getElementById("auth-links").style.display = "block";
    }
}

// Event listeners
window.onload = checkLoginStatus;
document.getElementById('cart-icon').addEventListener('click', function () {
    const token = localStorage.getItem("jwtToken");

    // Check if the user is logged in
    if (!token) {
        alert("Please log in to view items in your cart.");
        return;
    }

    // Fetch user role and validate it
    fetchUserRole(token)
        .then(role => {
            if (role !== 'customer') {
                alert("Only customers can view items in the cart. Please log in as a customer.");
                return;
            }

            // Proceed to fetch cart data if the user is a customer
            fetchCartData(token);
        })
        .catch(error => {
            console.error("Error fetching user role:", error);
            alert("An error occurred while verifying your role. Please try again.");
        });
});

document.getElementById('cart-close-btn').addEventListener('click', closeCartModal);

function closeCartModal() {
    document.getElementById('cartModal').style.display = 'none';
}

function logout() {
    localStorage.removeItem("jwtToken");
    window.location.href = "/index.html";
}

document.addEventListener("DOMContentLoaded", function () {

    const homeSection = document.getElementById("homeSection");
    const booksList = document.getElementById("booksList");
    const bookedList = document.getElementById("bookedList");

    // Function to show the home section
    function showHome() {
        homeSection.style.display = "block";
        booksList.style.display = "none";
        bookedList.style.display = "none";
    }

    // Function to show the books section
    function showBooks() {
        homeSection.style.display = "none";
        bookedList.style.display = "none";
        booksList.style.display = "block";
        loadAvailableBooks(); // Call your function to load available books
    }

    // Select the navbar links using their IDs
    const booksLink = document.getElementById("booksLink");
    const homeLink = document.getElementById("homeLink");

    // Check if the elements exist before adding event listeners
    if (booksLink) {
        booksLink.addEventListener('click', function (event) {
            event.preventDefault(); // Prevent default link behavior
            showBooks();
        });
    } else {
        console.error("Books link not found");
    }

    if (homeLink) {
        homeLink.addEventListener('click', function (event) {
            event.preventDefault(); // Prevent default link behavior
            showHome();
        });
    } else {
        console.error("Home link not found");
    }

    // Initially show the home section
    showHome();

    // Initially show the home section
    showHome();
    fetchCategories();
    fetchAuthors();
    fetchBestSellers();
    fetchNewArrivals();
    checkAdmin();
});

function checkAdmin() {
    // Fetch to check if an admin already exists
    fetch('http://localhost:8082/check-admin')
        .then(response => response.json())
        .then(data => {
            // If an admin already exists, hide the admin option
            if (data.adminExists) {
                document.getElementById('googleRole').querySelector('option[value="admin"]').style.display = 'none';
                document.getElementById('signupRole').querySelector('option[value="admin"]').style.display = 'none';

            }
        })
        .catch(error => console.error('Error checking for admin:', error));
}

function fetchBooksByCategory(category) {
    const homeSection = document.getElementById("homeSection");
    const bookedList = document.getElementById("bookedList");

    // Hide the home section and display the book list section
    homeSection.style.display = "none";
    bookedList.style.display = "block";

    // Fetch books by category
    fetch(`http://localhost:8082/api/books/category/${encodeURIComponent(category)}`)
        .then(response => {
            if (!response.ok) throw new Error("Failed to fetch books");
            return response.json();
        })
        .then(data => {
            if (!data.books || data.books.length === 0) {
                bookedList.innerHTML = "<p>No books found in this category.</p>";
            } else {
                bookedList.innerHTML = `
                    <div class="book-container">
                        ${data.books.map(book => `
                            <div class="book-card">
                                <img class="book-image" src="${book.cover_image}" alt="${book.title} Cover">
                                <div class="book-details">
                                    <h3 class="book-title">${book.title}</h3>
                                    <p class="book-description">${book.description}</p>
                                    <button class="view-details-button" onclick="openBookDetail(${book.book_id})">View Details</button>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error("Error fetching books:", error);
            bookedList.innerHTML = "<p>Error loading books. Please try again later.</p>";
        });
}

async function fetchCategories() {
    fetch('http://localhost:8082/fetch_categories')
        .then(response => response.json())
        .then(data => {
            const dropdown = document.getElementById('categoriesDropdown');
            dropdown.innerHTML = ''; // Clear placeholder
            data.forEach(category => {
                const item = document.createElement('a');
                item.className = 'dropdown-item';
                item.href = '#'; // Add actual links here if needed
                item.textContent = category.name;
                item.onclick = () => fetchBooksByCategory(category.name);
                dropdown.appendChild(item);
            });
        })
        .catch(error => {
            console.error('Error fetching categories:', error);
            document.getElementById('categoriesDropdown').innerHTML = '<a class="dropdown-item" href="#">Error Loading Categories</a>';
        });
}

async function fetchAuthors() {
    fetch('http://localhost:8082/fetch_authors')
        .then(response => response.json())
        .then(data => {
            const dropdown = document.getElementById('authorsDropdown');
            dropdown.innerHTML = ''; // Clear placeholder
            data.forEach(book => {
                const item = document.createElement('a');
                item.className = 'dropdown-item';
                item.href = '#'; // Add actual links here if needed
                item.textContent = book.author;
                item.addEventListener('click', (e) => {
                    e.preventDefault(); // Prevent default navigation
                    fetchBooksByAuthor(book.author); // Pass the author's name to the function
                });
                dropdown.appendChild(item);
            });
        })
        .catch(error => {
            console.error('Error fetching categories:', error);
            document.getElementById('categoriesDropdown').innerHTML = '<a class="dropdown-item" href="#">Error Loading Categories</a>';
        });
}

function fetchBooksByAuthor(author) {
    const homeSection = document.getElementById("homeSection");
    const bookedList = document.getElementById("bookedList");

    // Hide the home section and display the book list section
    homeSection.style.display = "none";
    bookedList.style.display = "block";

    // Fetch books by author
    fetch(`http://localhost:8082/api/books/${encodeURIComponent(author)}`)
        .then(response => {
            if (!response.ok) throw new Error("Failed to fetch books");
            return response.json();
        })
        .then(data => {
            if (!data.books || data.books.length === 0) {
                bookedList.innerHTML = "<p>No books found for this author.</p>";
            } else {
                bookedList.innerHTML = `
                    <div class="book-container">
                        ${data.books.map(book => `
                            <div class="book-card">
                                <img class="book-image" src="${book.cover_image}" alt="${book.title} Cover">
                                <div class="book-details">
                                    <h3 class="book-title">${book.title}</h3>
                                    <p class="book-description">${book.description}</p>
                                    <button class="view-details-button" onclick="openBookDetail(${book.book_id})">View Details</button>
                                </div>
                            </div>
                        `).join("")}
                    </div>
                `;
            }
        })
        .catch(error => {
            console.error("Error fetching books:", error);
            bookedList.innerHTML = "<p>Error loading books. Please try again later.</p>";
        });
}


function fetchFeaturedBooks() {
    fetch('http://localhost:8082/api/featured-books')
        .then(response => response.json())
        .then(books => {
            const booksCarouselInner = document.getElementById('booksCarouselInner');
            booksCarouselInner.innerHTML = ''; // Clear existing content

            let activeClass = 'active';
            const itemsPerSlide = 4; // Number of books to display per slide

            // Split books into chunks of 'itemsPerSlide' books
            for (let i = 0; i < books.length; i += itemsPerSlide) {
                const chunk = books.slice(i, i + itemsPerSlide);

                // Create carousel item with multiple books
                const carouselItem = `
            <div class="carousel-item ${activeClass}">
              <div class="row">
                ${chunk.map(book => {
                    let discountHTML = '';
                    if (book.discount_value) {
                        discountHTML = `
                          <p class="text-success">
                            <strong>Discount: ${book.discount_value}%</strong>
                          </p>
                          <p class="text-muted">
                            <small>Valid until: ${book.valid_until ? new Date(book.valid_until).toLocaleDateString() : 'N/A'}</small>
                          </p>
                        `;
                    }


                    return `
                      <div class="col-md-3">
                        <div class="card" style="width: 100%; height: auto;">
                          <img src="${book.cover_image}" class="card-img-top" alt="${book.title}" style="width: 100%; height: auto;">
                          <div class="card-body">
                            <h5 class="card-title">${book.title}</h5>
                            <p class="card-text">${book.description}</p>
                            ${discountHTML}
                            <button class="btn btn-primary" onclick="openBookDetail(${book.book_id})">View Details</button>
                          </div>
                        </div>
                      </div>
                    `;
                }).join('')}
              </div>
            </div>
          `;

                booksCarouselInner.innerHTML += carouselItem;

                if (activeClass === 'active') {
                    activeClass = '';
                }
            }
        })
        .catch(error => {
            console.error('Error fetching books:', error);
        });
}


// Fetch books immediately and every 30 seconds after
fetchFeaturedBooks();
setInterval(fetchFeaturedBooks, 30000);

function fetchBestSellers() {
    fetch('http://localhost:8082/best-sellers')
        .then(response => response.json())
        .then(books => {
            const booksCarouselInner = document.getElementById('bestSellersCarouselInner');
            booksCarouselInner.innerHTML = ''; // Clear existing content

            let activeClass = 'active';
            const itemsPerSlide = 4; // Number of books to display per slide

            // Split books into chunks of 'itemsPerSlide' books
            for (let i = 0; i < books.length; i += itemsPerSlide) {
                const chunk = books.slice(i, i + itemsPerSlide);

                // Create carousel item with multiple books
                const carouselItem = `
            <div class="carousel-item ${activeClass}">
              <div class="row">
                ${chunk.map(book => {
                    let discountHTML = '';
                    if (book.discount_value) {
                        discountHTML = `
                          <p class="text-success">
                            <strong>Discount: ${book.discount_value}%</strong>
                          </p>
                          <p class="text-muted">
                            <small>Valid until: ${book.valid_until ? new Date(book.valid_until).toLocaleDateString() : 'N/A'}</small>
                          </p>
                        `;
                    }

                    return `
                      <div class="col-md-3">
                        <div class="card" style="width: 100%; height: auto;">
                          <img src="${book.cover_image}" class="card-img-top" alt="${book.title}" style="width: 100%; height: auto;">
                          <div class="card-body">
                            <h5 class="card-title">${book.title}</h5>
                            <p class="card-text">${book.description}</p>
                            ${discountHTML}
                            <button class="btn btn-primary" onclick="openBookDetail(${book.book_id})">View Details</button>
                          </div>
                        </div>
                      </div>
                    `;
                }).join('') }
              </div>
            </div>
          `;

                booksCarouselInner.innerHTML += carouselItem;

                if (activeClass === 'active') {
                    activeClass = '';
                }
            }
        })
        .catch(error => {
            console.error('Error fetching best-sellers:', error);
        });
}

function fetchNewArrivals() {
    fetch('http://localhost:8082/api/new-arrivals')
        .then(response => response.json())
        .then(books => {
            const carouselContent = document.getElementById('carouselContent');
            carouselContent.innerHTML = ''; // Clear existing content
            let activeClass = 'active';
            let rowsHTML = '';

            books.forEach((book, index) => {
                if (index % 4 === 0) {
                    if (rowsHTML) {
                        rowsHTML += '</div></div>';
                    }
                    rowsHTML += `<div class="carousel-item ${activeClass}"><div class="row">`;
                    activeClass = ''; // Reset active class after the first item
                }

                let discountHTML = '';
                if (book.discount_value) {
                    discountHTML = `
                        <p class="text-success">
                            <strong>Discount: ${book.discount_value}%</strong>
                        </p>
                        <p class="text-muted">
                            <small>Valid until: ${book.valid_until ? new Date(book.valid_until).toLocaleDateString() : 'N/A'}</small>
                        </p>
                    `;
                }

                rowsHTML += `
                <div class="col-md-3">
                    <div class="card" style="width: 100%; height: auto;">
                        <img src="${book.cover_image}" class="card-img-top" alt="${book.title}" style="width: 100%; height: auto;">
                        <div class="card-body">
                            <h5 class="card-title">${book.title}</h5>
                            <p class="card-text">${book.description}</p>
                            ${discountHTML}
                            <button class="btn btn-primary" onclick="openBookDetail(${book.book_id})">View Details</button>
                        </div>
                    </div>
                </div>
                `;
            });

            if (rowsHTML) {
                rowsHTML += '</div></div>';
            }
            carouselContent.innerHTML = rowsHTML;
        })
        .catch(error => console.error('Error fetching new arrivals:', error));
}

function openBookDetail(bookId) {
    const modalContent = document.getElementById("bookDetailContent");

    // Fetch book details
    fetch(`http://localhost:8082/api/book/${bookId}`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
    })
        .then(response => {
            if (!response.ok) throw new Error('Failed to fetch book details');
            return response.json();
        })
        .then(book => {
            // Generate stars for average rating
            const fullStars = '★'.repeat(Math.floor(book.average_rating));
            const emptyStars = '☆'.repeat(5 - Math.floor(book.average_rating));

            // Generate reviews HTML
            const reviewsHTML = book.reviews.length > 0
                ? book.reviews.map(review => `
                    <div class="review">
                        <p><strong>${review.customer_name}</strong> (${new Date(review.created_at).toLocaleDateString()}):</p>
                        <p>${'★'.repeat(review.rating)}${'☆'.repeat(5 - review.rating)}</p>
                        <p>${review.review}</p>
                    </div>
                `).join('')
                : '<p>No reviews yet.</p>';
                

            // Populate initial modal content without price comparison
            modalContent.innerHTML = `
                <h2>${book.title}</h2>
                <img src="${book.cover_image}" alt="${book.title}" style="max-width: 100%; height: auto;">
                <p><strong>Author:</strong> ${book.author}</p>
                <p><strong>Publisher:</strong> ${book.publisher_name}</p>
                <p><strong>Description:</strong> ${book.description}</p>
                 <p><strong>Price:</strong> 
                    ${book.discount_value > 0 ? `<span style="text-decoration: line-through;">Rs. ${book.original_price}</span>` : ''} 
                    Rs. ${book.discounted_price} <!-- Ensuring discountedPrice is a number -->
                </p>
                <p><strong>Stock:</strong> ${book.stock}</p>
                <p><strong>Average Rating:</strong> ${fullStars}${emptyStars} (${book.total_ratings} ratings)</p>
                <div class="quantity-input">
                    <label for="quantity">Quantity:</label>
                    <input type="number" id="quantity" name="quantity" value="1" min="1" max="${book.stock}">
                </div>
                <button class="add-to-cart" onclick="addToCart(${book.book_id})">Add to Cart</button>

                <h3>Customer Reviews</h3>
                <div class="reviews">${reviewsHTML}</div>

                <!-- Comparison Container -->
                <div id="comparisonContainer"></div>

                <!-- Rating and Review Form -->
                <h3>Rate and Review this Book</h3>
                <form id="reviewForm" onsubmit="submitReview(event, ${book.book_id})">
                    <label for="rating">Rating:</label>
                    <select id="rating" name="rating" required>
                        <option value="1">1 ★</option>
                        <option value="2">2 ★</option>
                        <option value="3">3 ★</option>
                        <option value="4">4 ★</option>
                        <option value="5">5 ★</option>
                    </select>
                    <br>
                    <label for="review">Review:</label>
                    <textarea id="review" name="review" rows="4" required></textarea>
                    <br>
                    <button type="submit">Submit Review</button>
                </form>
            `;

            // Fetch price comparison data
            return fetch(`http://localhost:8082/compare_price/${encodeURIComponent(book.title)}`, {
                method: 'GET',
                headers: { 'Content-Type': 'application/json' },
            })
            .then(response => {
                if (!response.ok) throw new Error('Failed to fetch price comparison');
                return response.json();
            })
            .then(priceComparison => {
                console.log('Price Comparison:', priceComparison);  // Debugging log
            
                const comparisonContainer = document.getElementById('comparisonContainer');
                if (comparisonContainer) {
                    let priceComparisonHTML = '';
            
                    // Log the prices to check their values
                    const localPrice = priceComparison.local ? parseFloat(priceComparison.local.discounted_price) : null;
                    const booksvillaPrice = priceComparison.booksvilla ? parseFloat(priceComparison.booksvilla.price) : null;
                    const localDiscountValue = priceComparison.local ? parseFloat(priceComparison.local.discount_value) : 0; // Get discount value for local
                    console.log('Local Price:', localPrice);
                    console.log('BooksVilla Price:', booksvillaPrice);
                    console.log('Local Discount Value:', localDiscountValue);
            
                    // Determine the price to compare based on discount value
                    let localFinalPrice = localDiscountValue > 0 ? localPrice : (priceComparison.local ? parseFloat(priceComparison.local.price) : null);
                    
                    if (localFinalPrice && booksvillaPrice && booksvillaPrice > localFinalPrice) {
                        priceComparisonHTML += `
                            <div class="comparison">
                                <h3>Price Comparison</h3>
                                <p><strong>Local Price:</strong> Rs. ${localFinalPrice}</p>
                                <p><strong>BooksVilla Price:</strong> Rs. ${booksvillaPrice}</p>
                            </div>
                        `;
                        console.log('Price comparison HTML:', priceComparisonHTML);
                    } else {
                        console.log('Price comparison not displayed. Conditions not met:');
                        console.log('Local Price:', localFinalPrice, 'BooksVilla Price:', booksvillaPrice);
                    }
                    comparisonContainer.innerHTML = priceComparisonHTML || '';
                }
            })
        .catch(error => {
            console.error(error);
            const comparisonContainer = document.getElementById('comparisonContainer');
            if (comparisonContainer) {
                comparisonContainer.innerHTML = '<p>Failed to fetch price comparison.</p>';
            }
        })
        .finally(() => {
            // Display the modal
            document.getElementById("bookDetailModal").style.display = "flex";
        });
        })
    }

function submitReview(event, bookId) {
    event.preventDefault(); // Prevent the default form submission

    const rating = document.getElementById("rating").value;
    const reviewText = document.getElementById("review").value;
    const token = localStorage.getItem("jwtToken");
    if (!token) {
        // If the token is not available, the user is not logged in
        alert("Please log in to submit feedback.");
        return;
    }
    // Get the user information (you can get this from your session or logged-in user)
    const reviewData = {
        book_id: bookId,
        review: reviewText,
        rating: rating
    };

    // Send the review data to the server
    fetch(`http://localhost:8082/api/book/${bookId}/review`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify(reviewData)
    })
        .then(response => {
            if (!response.ok) throw new Error('Failed to submit review');
            return response.json();
        })
        .then(data => {
            alert('Review submitted successfully!');
            // Optionally, refresh the reviews or update the modal with the new review
            openBookDetail(bookId); // Reload the book details with the new review
        })
        .catch(error => {
            console.error('Error submitting review:', error);
            alert('Failed to submit review. Please try again later.');
        });
}


function closeBookDetailModal() {
    document.getElementById("bookDetailModal").style.display = "none";
}

function addToCart(bookId) {
    const token = localStorage.getItem("jwtToken");
    if (!token) {
        alert("Please log in to add book to cart");
        return;
    }

    const quantity = document.getElementById("quantity").value;
    fetch('http://localhost:8082/api/cart', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ bookId, quantity })
    })
        .then(response => {
            if (!response.ok) throw new Error('Failed to add to cart');
            alert('Book added to cart successfully!');
            closeBookDetailModal();
        })
        .catch(error => {
            console.error('Error adding book to cart:', error);
            alert('Failed to add book to cart. Please try again later.');
        });
}


document.getElementById("feedbackForm").addEventListener("submit", function (event) {
    event.preventDefault();  // Prevent form submission

    // Get the user's token from localStorage (or sessionStorage)
    const token = localStorage.getItem('jwtToken'); // Replace with the actual method of retrieving the token

    if (!token) {
        // If the token is not available, the user is not logged in
        alert("Please log in to submit feedback.");
        return;
    }

    // Call fetchUserRole function to check if the logged-in user is a customer
    fetchUserRole(token)
        .then(role => {
            if (role === 'customer') {
                // If the user is a customer, allow the form to be submitted
                alert("Feedback submitted successfully!");
                // Reset the form
                document.getElementById("feedbackForm").reset();
            } else {
                // If the user is not a customer, show a message
                alert("Only customers are allowed to submit feedback.");
            }
        })
        .catch(error => {
            // Handle errors from the fetchUserRole function
            alert("Unable to verify user role. Please try again later.");
            console.error(error);
        });
});

function loadAvailableBooks() {
    fetch('http://localhost:8082/api/books')
        .then(response => {
            if (!response.ok) {
                throw new Error(`Error fetching books: ${response.statusText}`);
            }
            return response.json();
        })
        .then(books => {
            console.log('Books fetched:', books); // Debug log
            const booksList = document.getElementById("booksList");
            const availableBooksContainer = document.getElementById("availableBooksContainer");

            // Clear previous books
            availableBooksContainer.innerHTML = '';

            books.forEach(book => {
                const bookCard = `
                <div class="book-card">
                    <img src="${book.cover_image}" alt="${book.title}" class="book-cover">
                    <h2>${book.title}</h2>
                    <p>Author: ${book.author}</p>
                    <p>Price: Rs. ${book.price}</p>
                    <p>Stock: ${book.stock}</p>
                    <button class="btn btn-primary" onclick="openBookDetail(${book.book_id})">View Details</button>

                </div>
            `;
                availableBooksContainer.innerHTML += bookCard;
            });

            // Show the books section
            booksList.style.display = 'block';
        })
        .catch(error => {
            console.error(error);
            alert("Failed to load books. Please try again later.");
        });
}

// Function to fetch and display order details
function trackMyOrder() {
    const token = localStorage.getItem("jwtToken");
    if (!token) {
        alert("Please login first");
    }
    fetch("http://localhost:8082/api/orders", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            'Authorization': `Bearer ${token}`
        },

    })
        .then(response => {
            if (!response.ok) throw new Error("Failed to fetch orders");
            return response.json();
        })
        .then(data => {
            const { orders } = data; // Extract orders array from response
            const orderDetails = document.getElementById("orderDetails");

            if (!orders || orders.length === 0) {
                orderDetails.innerHTML = "<p>No orders found.</p>";
            } else {
                orderDetails.innerHTML = orders.map(order => `
                <div class="order">
                    <p><strong>Order ID:</strong> ${order.order_id}</p>
                    <p><strong>Total Price:</strong> Rs. ${(Number(order.total_price) || 0).toFixed(2)}</p>
                    <p><strong>Status:</strong> ${order.order_status}</p>
                    <p><strong>Delivery Date:</strong> ${order.delivery_date || "Not available"}</p>
                    <p><strong>Shipping Status:</strong> ${order.shipping_status || "Not available"}</p>
                    <p><strong>Estimated Delivery:</strong> ${order.estimated_delivery_date || "Not available"}</p>
                    <hr>
                </div>
            `).join("");
            }

            // Show the modal
            document.getElementById("orderModal").style.display = "flex";
        })
        .catch(error => {
            console.error("Error fetching orders:", error);
            alert("Failed to load orders. Please try again later.");
        });
}

// Function to close the modal
function closeOrderModal() {
    document.getElementById("orderModal").style.display = "none";
}

async function fetchComparison() {
    const resultsDiv = document.getElementById('comparisonResults');

    try {
        const response = await fetch('http://localhost:8082/compare_price/:book'); // Backend endpoint to get comparison data
        const data = await response.json();

        if (response.ok) {
            const comparisonsHTML = data.map(item => `
                <div class="comparison">
                    <h3>${item.book_name}</h3>
                    <p><strong>Local Price:</strong> ${item.local_price}</p>
                    <p><strong>BooksVilla Price:</strong> ${item.booksvilla_price}</p>
                </div>
            `).join('');

            resultsDiv.innerHTML = comparisonsHTML;
        } else {
            resultsDiv.innerHTML = `<p>${data.error || 'Failed to fetch comparison data'}</p>`;
        }
    } catch (err) {
        console.error(err);
        resultsDiv.innerHTML = '<p>An error occurred while fetching data.</p>';
    }
}




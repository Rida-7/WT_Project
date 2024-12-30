document.addEventListener("DOMContentLoaded", function () {
  const navLinks = document.querySelectorAll('.sidebar ul li a');
  const sections = document.querySelectorAll('section');

  navLinks.forEach(link => {
    link.addEventListener('click', (e) => {
      e.preventDefault(); // Prevent default link behavior

      const targetId = link.getAttribute('href').substring(1);

      sections.forEach(section => section.style.display = 'none');

      const targetSection = document.getElementById(targetId);
      if (targetSection) {
        targetSection.style.display = 'block';
      }
    });
  });
  fetchPublisherOverview();
  fetchBooks();
  fetchPublisherOrders();
  loadFeedback();
  analytics();
  discount();
  // fetchUserData();
  document.getElementById("update-button").addEventListener("click", function () {
    const bookId = document.getElementById("edit-book-id").value;
    alert(bookId);
    updateBook(bookId);
  });
});

function fetchPublisherOverview() {
  const token = localStorage.getItem("jwtToken");
  console.log('Retrieved Token:', token); // Log to check if token is retrieved

  if (!token) {
    console.error("JWT token not found in localStorage");
    return; // Exit if token is not available
  }
  fetch(`http://localhost:8082/publisher/overview`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
    .then((response) => response.json())
    .then((data) => {
      console.log(data);  // Add this to inspect the response from the server
      document.getElementById("total-sales").innerText = `₨. ${parseFloat(data.total_sales).toFixed(2)}`;
      document.getElementById("total-books").innerText = data.total_books_added;
      document.getElementById("order-count").innerText = data.order_count;
    })
    .catch((error) => {
      console.error("Error fetching publisher overview:", error);
    });
}


// Fetch Books and Display Them
function fetchBooks() {
  const token = localStorage.getItem("jwtToken");
  console.log('Retrieved Token:', token); // Log to check if token is retrieved

  if (!token) {
    console.error("JWT token not found in localStorage");
    return; // Exit if token is not available
  }
  fetch(`http://localhost:8082/publisher/listings`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
    .then((response) => response.json())
    .then((data) => {
      console.log(data); // Log data to inspect the structure
      const bookTable = document.querySelector(".book-table");
      bookTable.innerHTML = ""; // Clear existing content
      if (Array.isArray(data) && data.length > 0) {
        data.forEach((book) => {
          const bookCard = document.createElement("div");
          bookCard.classList.add("book-card");
          bookCard.innerHTML = `
                          <img src="${book.cover_image}" alt="${book.title}" class="book-image"/>
                          <div class="book-info">
                              <h3 class="book-title">${book.title}</h3>
                              <p class="book-author">Author: ${book.author}</p>
                              <p class="book-category">Category: ${book.category_names}</p> <!-- Updated field name -->
                              <p class="book-price">Price: Rs. ${book.price}</p>
                              <p class="book-stock">Stock: ${book.stock}</p>
                              <div class="book-actions">
                                  <button onclick="editBook(${book.book_publisher_id})" class="btn btn-edit">Edit</button>
                                  <button onclick="deleteBook(${book.book_publisher_id})" class="btn btn-delete">Delete</button>
                              </div>
                          </div>
                      `;
          bookTable.appendChild(bookCard);
        });
      } else {
        bookTable.innerHTML = "<p>No books available to display.</p>";
      }
    })
    .catch((error) => {
      console.error("Error fetching books:", error);
    });
}

// Open Modal to Add a New Book
document.getElementById("add-book").addEventListener("click", function () {
  document.getElementById("addBookModal").style.display = "block";
  // const modalHeader = document.querySelector("#addBookModal h2");
  //     if (modalHeader) {
  //       modalHeader.textContent = "Add New Book"; // Update the header
  //     }
  //     // Update button for editing
  //     const addButton = document.querySelector("button[type='submit']");
  //     addButton.innerText = "Add Book";
});

// Close Modal
document.querySelector(".close").addEventListener("click", function () {
  document.getElementById("addBookModal").style.display = "none";
  document.getElementById("add-book-form").reset();
});

// Add New Book
document.getElementById("add-book-form").addEventListener("submit", async function (e) {
  e.preventDefault();

  const formData = new FormData();

  // Add text data
  formData.append("title", document.getElementById("book-title").value);
  formData.append("author", document.getElementById("book-author").value);
  formData.append("description", document.getElementById("book-description").value);
  formData.append("publishedYear", document.getElementById("book-publishedYear").value);
  formData.append("categories", document.getElementById("book-category").value.split(",").map(c => c.trim()));
  formData.append("price", document.getElementById("book-price").value);
  formData.append("stock", document.getElementById("book-stock").value);

  // Add cover image (check if it's a URL or a file)
  const coverUrlInput = document.getElementById("book-cover-url");
  const coverFileInput = document.getElementById("book-cover-upload");

  // Handle cover image (file upload or URL)
  if (coverUrlInput.value) {
    formData.append("cover_url", coverUrlInput.value); // User provided URL
  } else if (coverFileInput.files.length > 0) {
    formData.append("book-cover-upload", coverFileInput.files[0]); // User uploaded file
  }

  const token = localStorage.getItem("jwtToken"); // Modify based on where you store the token
  console.log('Retrieved Token:', token); // Log to check if token is retrieved

  if (!token) {
    console.error("JWT token not found in localStorage");
    return; // Exit if token is not available
  }

  try {
    const response = await fetch("http://localhost:8082/publisher/add-book", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`, // Include token in headers
      },
      body: formData, // Send FormData object
    });

    const data = await response.json();
    console.log("Book added:", data);

    // Clear form and close modal
    document.getElementById("add-book-form").reset();
    document.getElementById("addBookModal").style.display = "none";
  } catch (error) {
    console.error("Error adding book:", error);
  }
});

// Delete Book
function deleteBook(bookId) {
  const token = localStorage.getItem("jwtToken"); // Modify based on where you store the token
  console.log('Retrieved Token:', token); // Log to check if token is retrieved

  if (!token) {
    console.error("JWT token not found in localStorage");
    return; // Exit if token is not available
  }

  fetch(`http://localhost:8082/books/${bookId}`, {
    method: "DELETE",
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
    .then((response) => response.json())
    .then((data) => {
      console.log("Book deleted:", data);
      fetchBooks(); // Reload books
    })
    .catch((error) => {
      console.error("Error deleting book:", error);
    });
}

// Edit Book (Optional: Open modal to edit book details)
// Function to handle editing a book
function editBook(bookId) {
  console.log("Editing Book ID:", bookId);
  const token = localStorage.getItem("jwtToken");

  if (!token) {
      console.error("JWT token not found in localStorage");
      return;
  }

  fetch(`http://localhost:8082/publisher/listings/${bookId}`, {
      method: "GET",
      headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
      }
  })
      .then((response) => {
          if (!response.ok) {
              throw new Error(`Failed to fetch book details: ${response.statusText}`);
          }
          return response.json();
      })
      .then((book) => {
          console.log("Fetched Book Data:", book); // Debug response

          // Map book data to the form fields
          const bookTitleField = document.getElementById("edit-book-title");
          if (bookTitleField && book.title) bookTitleField.value = book.title;

          const bookAuthorField = document.getElementById("edit-book-author");
          if (bookAuthorField && book.author) bookAuthorField.value = book.author;

          const bookPriceField = document.getElementById("edit-book-price");
          if (bookPriceField && book.price) bookPriceField.value = book.price;

          const bookStockField = document.getElementById("edit-book-stock");
          if (bookStockField && book.stock) bookStockField.value = book.stock;

          const bookCoverUrlField = document.getElementById("edit-book-cover-url");
          if (bookCoverUrlField && book.cover_image) bookCoverUrlField.value = book.cover_image;

          const bookDescriptionField = document.getElementById("edit-book-description");
          if (bookDescriptionField && book.description) bookDescriptionField.value = book.description;

          const bookPublishedYearField = document.getElementById("edit-book-publishedYear");
          if (bookPublishedYearField && book.published_year) bookPublishedYearField.value = book.published_year;

          const bookCategoryField = document.getElementById("edit-book-category");
          if (bookCategoryField && book.category_names) {
              bookCategoryField.value = book.category_names.split(", ").join(", ");
          }

          const bookIdField = document.getElementById("edit-book-id");
          if (bookIdField && book.book_publisher_id) bookIdField.value = book.book_publisher_id;

          // Show the modal
          const modal = document.getElementById("editBookModal");
          modal.style.display = "block";

          // Handle cover image toggle
          toggleInput(book.cover_image ? 'url' : 'upload', false);
      })
      .catch((error) => {
          console.error("Error fetching book details:", error);
      });
}

// Function to update book details
async function updateBook() {
  const token = localStorage.getItem("jwtToken");

  if (!token) {
      console.error("JWT token not found in localStorage");
      return;
  }

  // Get form field values
  const bookId = document.getElementById("edit-book-id").value;
  const updatedBook = {
      title: document.getElementById("edit-book-title").value,
      author: document.getElementById("edit-book-author").value,
      price: parseFloat(document.getElementById("edit-book-price").value),
      stock: parseInt(document.getElementById("edit-book-stock").value),
      cover_image: document.getElementById("edit-book-cover-url").value,
      description: document.getElementById("edit-book-description").value,
      published_year: parseInt(document.getElementById("edit-book-publishedYear").value),
      category_names: document.getElementById("edit-book-category").value.split(", ").join(", ")
  };

  fetch(`http://localhost:8082/publisher/listings/${bookId}`, {
      method: "PUT",
      headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
      },
      body: JSON.stringify(updatedBook)
  })
      .then((response) => {
          if (!response.ok) {
              throw new Error(`Failed to update book: ${response.statusText}`);
          }
          return response.json();
      })
      .then((result) => {
          console.log("Book updated successfully:", result);
          alert("Book updated successfully!");

          // Close the modal
          const modal = document.getElementById("editBookModal");
          modal.style.display = "none";

          // Refresh the page or update the UI dynamically
          location.reload();
      })
      .catch((error) => {
          console.error("Error updating book:", error);
          alert("Error updating book. Please try again.");
      });
}

// Function to fetch orders for the publisher and display them
function fetchPublisherOrders() {
  const ordersList = document.querySelector('.orders-list');

  if (!ordersList) {
    console.error('Orders list element not found');
    return;
  }
  const token = localStorage.getItem("jwtToken"); // Modify based on where you store the token
  console.log('Retrieved Token:', token); // Log to check if token is retrieved

  if (!token) {
    console.error("JWT token not found in localStorage");
    return; // Exit if token is not available
  }

  fetch(`http://localhost:8082/publisher/orders`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    }
  })
    .then((response) => response.json())
    .then((data) => {
      console.log(data); // Log the fetched data to verify it contains customer_name, book_title, etc.

      ordersList.innerHTML = '';  // Clear any existing orders

      if (data.length === 0) {
        const noOrdersMessage = document.createElement('p');
        noOrdersMessage.classList.add('no-orders-message');
        noOrdersMessage.textContent = 'No orders found for this publisher.';
        ordersList.appendChild(noOrdersMessage);
        return;
      }

      data.forEach((order) => {
        const orderDiv = document.createElement('div');
        orderDiv.classList.add('order-item');
      
        let statusClass = '';
        console.log('Order Status:', order.order_status); // Log the order status for debugging
      
        // Normalize the order status for comparison (trim spaces, case insensitive)
        const orderStatusNormalized = order.order_status.trim().toLowerCase();
      
        // Set the correct status class based on the normalized order status
        if (orderStatusNormalized === 'pending') {
          statusClass = 'pending';
        } else if (orderStatusNormalized === 'shipped') {
          statusClass = 'shipped';
        } else if (orderStatusNormalized === 'delivered') {
          statusClass = 'completed';
        } else if (orderStatusNormalized === 'canceled') {
          statusClass = 'canceled';
        }
      
        // Create the order display
        orderDiv.innerHTML = `
          <h3>Order ID: ${order.order_id}</h3>
          <p><strong>Amount:</strong> $${order.total_amount}</p>
          <p><strong>Status:</strong> <span class="status ${statusClass}">${order.order_status}</span></p>
          <p><strong>Customer:</strong> ${order.customer_name}</p>
          <p><strong>Book Title:</strong> ${order.book_title}</p>
          <p><strong>Quantity:</strong> ${order.quantity}</p>
          <p><strong>Price:</strong> $${order.price}</p>
        `;
      
        // Only show "Update Shipping" if the order status is not 'delivered' or 'canceled'
        if (orderStatusNormalized !== 'delivered' && orderStatusNormalized !== 'canceled') {
          const updateShippingButton = document.createElement('button');
          updateShippingButton.classList.add('update-shipping-btn');
          updateShippingButton.setAttribute('data-order-id', order.order_id);
          updateShippingButton.textContent = 'Update Shipping';
      
          // Append the update button
          orderDiv.appendChild(updateShippingButton);
        }
      
        // Append the order to the orders list
        ordersList.appendChild(orderDiv);
      });      
    })
    .catch((error) => {
      console.error('Error fetching publisher orders:', error);
    });
}

// Function to fetch and display feedback
function loadFeedback() {
  const feedbackContainer = document.getElementsByClassName('reviews-container')[0]; // Use [0] to select the first element

  if (!feedbackContainer) {
    console.error('Error: Feedback container not found in the DOM');
    return;
  }

  feedbackContainer.innerHTML = '<p>Loading feedback...</p>';
  const token = localStorage.getItem("jwtToken"); // Modify based on where you store the token
  console.log('Retrieved Token:', token); // Log to check if token is retrieved

  if (!token) {
    console.error("JWT token not found in localStorage");
    return; // Exit if token is not available
  }

  fetch(`http://localhost:8082/publisher/feedback`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
    .then(response => {
      if (!response.ok) {
        throw new Error('Failed to fetch feedback');
      }
      return response.json();
    })
    .then(data => {
      console.log('Feedback Data:', data);

      feedbackContainer.innerHTML = ''; // Clear loading message

      if (data.feedback.length === 0) {
        feedbackContainer.innerHTML = '<p>No feedback found for this publisher.</p>';
        return;
      }

      data.feedback.forEach(feedback => {
        const feedbackItem = document.createElement('div');
        feedbackItem.className = 'feedback-item';

        // Generate stars based on the rating
        const starRating = Array(feedback.rating)
          .fill('⭐')
          .join('');

        feedbackItem.innerHTML = `
                <h3>${feedback.book_title || 'Unknown Book'}</h3>
                <p><strong>Rating:</strong> <span class="star-rating">${starRating}</span></p>
                <p>${feedback.comment || 'No comments provided'}</p>
                <p class="date">Feedback Date: ${new Date(feedback.feedback_date).toLocaleDateString()}</p>
                <p><strong>Customer:</strong> ${feedback.customer?.username || 'Anonymous'}</p>
            `;

        feedbackContainer.appendChild(feedbackItem);
      });
    })
    .catch(error => {
      console.error('Error fetching feedback:', error);
      feedbackContainer.innerHTML = '<p>Failed to load feedback. Please try again later.</p>';
    });
}

// Function to fetch and update sales and top books analytics
function analytics() {
  const token = localStorage.getItem("jwtToken"); // Modify based on where you store the token
  console.log('Retrieved Token:', token); // Log to check if token is retrieved

  if (!token) {
    console.error("JWT token not found in localStorage");
    return; // Exit if token is not available
  }
  // Request sales analytics data for the logged-in publisher
  fetch(`http://localhost:8082/analytics/sales`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
  })
    .then(response => response.json())
    .then(data => {
      // Process and display the data on your page
      console.log(data);

      // Update the sales chart
      updateSalesChart(data.monthlySales);

      // Update the top-selling books chart
      updateTopBooksChart(data.topBooks);
    })
    .catch(error => {
      console.error('Error fetching sales data:', error);
    });
}


// Function to update the sales chart
function updateSalesChart(monthlySales) {
  const ctx = document.getElementById('salesChart1').getContext('2d');
  const salesData = {
    labels: monthlySales.map(item => `${item.month}-${item.year}`),
    datasets: [{
      label: 'Total Sales',
      data: monthlySales.map(item => item.total_sales),
      borderColor: 'rgba(75, 192, 192, 1)',
      fill: false
    }]
  };

  const options = {
    responsive: true,
    scales: {
      x: {
        title: {
          display: true,
          text: 'Month-Year'  // X axis title
        }
      },
      y: {
        title: {
          display: true,
          text: 'Total Sales'  // Y axis title
        },
        beginAtZero: true  // Ensure the Y axis starts from 0
      }
    }
  };

  new Chart(ctx, {
    type: 'line',
    data: salesData,
    options: options
  });
}

// Function to update the top-selling books chart
function updateTopBooksChart(topBooks) {
  const ctx = document.getElementById('salesChart2').getContext('2d');
  const booksData = {
    labels: topBooks.map(item => item.book_title),
    datasets: [{
      label: 'Top-Selling Books',
      data: topBooks.map(item => item.total_quantity_sold),
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      borderColor: 'rgba(54, 162, 235, 1)',
      borderWidth: 1
    }]
  };

  const options = {
    responsive: true,
    scales: {
      x: {
        title: {
          display: true,
          text: 'Book Title'  // X axis title
        }
      },
      y: {
        title: {
          display: true,
          text: 'Quantity Sold'  // Y axis title
        },
        beginAtZero: true  // Ensure the Y axis starts from 0
      }
    }
  };

  new Chart(ctx, {
    type: 'bar',
    data: booksData,
    options: options
  });
}

// document.getElementById('discount-form').addEventListener('submit', function (event) {
//   event.preventDefault();  // Prevent the default form submission

//   const discountCode = document.getElementById('discount-code').value;
//   const description = document.getElementById('discount-description').value;
//   const discountType = document.getElementById('discount-type').value;
//   const discountValue = document.getElementById('discount-value').value;
//   const expiryDate = document.getElementById('discount-expiry').value;

//   const discountData = {

//     discount_code: discountCode,
//     description: description,
//     discount_type: discountType,
//     discount_value: discountValue,
//     valid_from: new Date().toISOString().split('T')[0],  // Current date as the start date
//     valid_until: expiryDate,
//     is_active: true,  // Assuming the discount is active when created
//   };

//   const token = localStorage.getItem("jwtToken"); // Modify based on where you store the token
//   console.log('Retrieved Token:', token); // Log to check if token is retrieved

//   if (!token) {
//     console.error("JWT token not found in localStorage");
//     return; // Exit if token is not available
//   }
//   // Send the discount data to the server via fetch
//   fetch('http://localhost:8082/discounts', {
//     method: 'POST',
//     headers: {
//       'Content-Type': 'application/json',
//       'Authorization': `Bearer ${token}`
//     },
//     body: JSON.stringify(discountData),
//   })
//     .then(response => response.json())
//     .then(data => {
//       if (data.success) {
//         alert('Discount applied successfully!');
//         // Optionally, clear the form fields after successful submission
//         document.getElementById('discount-form').reset();
//       } else {
//         alert('Failed to apply discount. Please try again.');
//       }
//     })
//     .catch(error => {
//       console.error('Error applying discount:', error);
//       alert('An error occurred while applying the discount.');
//     });
// });

//  // Function to fetch user data from the backend
//  function fetchUserData() {
//   const token = localStorage.getItem("jwtToken"); // Modify based on where you store the token
//   console.log('Retrieved Token:', token); // Log to check if token is retrieved

//   if (!token) {
//     console.error("JWT token not found in localStorage");
//     return; // Exit if token is not available
//   }
//   fetch(`http://localhost:8082/profile`, {
//     method: 'GET',
//     headers: {
//       'Authorization': `Bearer ${token}`,
//       'Content-Type': 'application/json'
//     }
//   })
//     .then((response) => response.json())
//     .then((data) => {
//       console.log(data);  // Add this to inspect the response from the server
//       document.getElementById('company-name').value = data.company_name || '';
//       document.getElementById('name').value = data.name || '';
//       document.getElementById('phone-number').value = data.phone_number || '';
//       document.getElementById('address').value = data.address || '';
//     })
//     .catch((error) => {
//       console.error("Error fetching publisher overview:", error);
//     });
// };

// async function updateUserData() {
//   console.log("Update button clicked"); // Log function entry

//   const token = localStorage.getItem("jwtToken");
//   console.log("Token:", token);

//   if (!token) {
//     alert("You must be logged in to update your profile.");
//     return;
//   }

//   // Log before fetching form values
//   console.log("Fetching form data...");

//   const companyName = document.getElementById('company-name').value;
//   const name = document.getElementById('name').value;
//   const phoneNumber = document.getElementById('phone-number').value;
//   const address = document.getElementById('address').value;
//   const oldPassword = document.getElementById('oPassword').value;
//   const newPassword = document.getElementById('nPassword').value;
//   const coverImage = document.getElementById('legal-document').files[0];

//   console.log("Form Data:", { companyName, name, phoneNumber, address });

//   const formData = new FormData();
//   formData.append('company_name', companyName);
//   formData.append('name', name);
//   formData.append('phone_number', phoneNumber);
//   formData.append('address', address);
//   formData.append('old_password', oldPassword);
//   formData.append('new_password', newPassword);
//   if (coverImage) {
//     formData.append('legal-document', coverImage);
//   }

//   try {
//     console.log("Sending API request...");
//     const response = await fetch(`http://localhost:8082/updateProfile`, {
//       method: 'POST',
//       headers: { Authorization: `Bearer ${token}` },
//       body: formData,
//     });

//     console.log("Response received:", response);
//     const data = await response.json();
//     console.log("Response data:", data);

//     if (response.ok) {
//       alert("Profile updated successfully!");
//     } else {
//       alert(data.message || "Failed to update profile.");
//     }
//   } catch (error) {
//     console.error("Error updating profile:", error);
//     alert("An error occurred while updating your profile.");
//   }
// }


// // Add an event listener to the form's submit button
// document.getElementById('update-profile-btn').addEventListener('submit', (e) => {
//   e.preventDefault(); // Prevent the default form submission behavior
//   updateUserData(); // Call the function
// });


// Toggle between URL input and file upload
function toggleInput(option) {
  const urlContainer = document.getElementById('url-input-container');
  const fileContainer = document.getElementById('file-input-container');

  if (option === 'url') {
    urlContainer.style.display = 'block';
    fileContainer.style.display = 'none';
  } else if (option === 'upload') {
    urlContainer.style.display = 'none';
    fileContainer.style.display = 'block';
  }
}

// Toggle between URL and File input for cover image
function toggleInputEdit(inputType, initialize = false) {
  const urlInput = document.getElementById("edit-url-input-container");
  const fileInput = document.getElementById("edit-file-input-container");

  if (inputType === 'url') {
    urlInput.style.display = initialize ? 'block' : 'none';
    fileInput.style.display = 'none';
  } else {
    urlInput.style.display = 'none';
    fileInput.style.display = initialize ? 'block' : 'none';
  }
}

// Close the modal
function closeEditBookModal() {
  document.getElementById("editBookModal").style.display = "none";
}

// Handle opening the modal when the "Update Shipping" button is clicked
document.addEventListener('click', function (event) {
  if (event.target && event.target.classList.contains('update-shipping-btn')) {
    const orderId = event.target.getAttribute('data-order-id');
    const modal = document.getElementById('updateShippingModal');
    const orderIdInput = document.getElementById('shipping-order-id');
    orderIdInput.value = orderId;

    // Open the modal
    modal.style.display = 'block';
  }
});

// Close the modal when the user clicks the close button
document.querySelector('.modal .close').addEventListener('click', function () {
  const modal = document.getElementById('updateShippingModal');
  modal.style.display = 'none';
});

document.querySelector('.logout').addEventListener('click', function(event) {
  event.preventDefault(); // Prevent the default anchor behavior

  // Remove the JWT token from localStorage
  localStorage.removeItem("jwtToken");

  // Optionally, you can also clear any other data like user information
  // localStorage.removeItem("userData");

  // Redirect the user to the login page or homepage
  window.location.href = "/index.html"; // Adjust the redirect path as needed
});



function discount() {
  fetch('http://localhost:8082/publisher-books',{
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${localStorage.getItem('jwtToken')}`
      }
  })
    .then(response => response.json())
    .then(books => {
      const bookSelect = document.getElementById('book-select');
      books.forEach(book => {
        const option = document.createElement('option');
        option.value = book.publisher_book_id;
        option.textContent = book.title;
        bookSelect.appendChild(option);
      });
    })
    .catch(error => console.error('Error fetching books:', error));

  // Handle form submission
  document.getElementById('discount-form').addEventListener('submit', (event) => {
    event.preventDefault();

    const discountData = {
      discountCode: document.getElementById('discount-code').value,
      discountDescription: document.getElementById('discount-description').value,
      discountValue: document.getElementById('discount-value').value,
      discountExpiry: document.getElementById('discount-expiry').value,
      publisherBookId: document.getElementById('book-select').value
    };

    fetch('http://localhost:8082/apply-discount', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(discountData)
    })
      .then(response => response.json())
      .then(data => {
        if (data.success) {
          alert('Discount applied successfully!');
        } else {
          alert('Failed to apply discount');
        }
      })
      .catch(error => console.error('Error applying discount:', error));
  });
}
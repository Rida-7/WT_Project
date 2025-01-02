
// Toggle sub-navigation for publisher, category, and customer sections
function toggleSubNavbar(subNavbarId) {
  const subNavbar = document.getElementById(subNavbarId);
  if (subNavbar) {
    const isCurrentlyVisible = subNavbar.style.display === 'block';
    subNavbar.style.display = isCurrentlyVisible ? 'none' : 'block';
  }
}

// Show Publisher Update Form and Pre-fill data
// Function to show the update form for publisher approval status
function showPublisherUpdateForm() {
  const token = localStorage.getItem("jwtToken");

  // Check if the token exists and is valid
  if (!token || token === "undefined") {
      alert("Please log in to update publisher information.");
      return;
  }

  console.log("Token from localStorage:", token); // Log token for debugging

  // Create the form dynamically
  const contentArea = document.getElementById("contentArea");
  contentArea.innerHTML = ""; // Clear existing content

  // Create a label and dropdown for Publisher ID
  const publisherIdLabel = document.createElement("label");
  publisherIdLabel.textContent = "Select Publisher ID:";
  const publisherIdSelect = document.createElement("select");
  publisherIdSelect.id = "publisherId";

  // Fetch publishers and populate the dropdown
  fetch("https://accidental-glen-kingfisher.glitch.me/publishers", {
      method: "GET",
      headers: {
          "Authorization": `Bearer ${token}`
      }
  })
  .then(response => {
      if (!response.ok) {
          throw new Error("Failed to fetch publishers.");
      }
      return response.json();
  })
  .then(publishers => {
      // Populate the dropdown with publishers
      publishers.forEach(publisher => {
          const option = document.createElement("option");
          option.value = publisher.publisher_id;
          option.textContent = `ID: ${publisher.publisher_id} - ${publisher.publisher_name}`;
          publisherIdSelect.appendChild(option);
      });

      // Append the publisherId dropdown to the content area
      contentArea.appendChild(publisherIdLabel);
      contentArea.appendChild(publisherIdSelect);
      contentArea.appendChild(document.createElement("br"));

      // Create a label and dropdown for Approval Status
      const approvalStatusLabel = document.createElement("label");
      approvalStatusLabel.textContent = "Select Approval Status:";
      const approvalStatusSelect = document.createElement("select");
      approvalStatusSelect.id = "approvalStatus";

      // Add options to the dropdown
      const approvedOption = document.createElement("option");
      approvedOption.value = "approved";
      approvedOption.textContent = "Approved";
      const pendingOption = document.createElement("option");
      pendingOption.value = "pending";
      pendingOption.textContent = "Pending";

      approvalStatusSelect.appendChild(approvedOption);
      approvalStatusSelect.appendChild(pendingOption);

      // Create the Update button
      const updateButton = document.createElement("button");
      updateButton.textContent = "Update";
      updateButton.onclick = function () {
          const publisherId = publisherIdSelect.value;
          const newStatus = approvalStatusSelect.value;

          if (!publisherId) {
              alert("Please select a valid Publisher ID.");
              return;
          }

          console.log("Attempting to update publisher ID:", publisherId);
          console.log("Approval status:", newStatus);

          // Make the API call to update the status
          fetch(`https://accidental-glen-kingfisher.glitch.me/publisher/update/${publisherId}`, {
              method: "PUT",
              headers: {
                  "Authorization": `Bearer ${token}`,
                  "Content-Type": "application/json",
              },
              body: JSON.stringify({ approval_status: newStatus }),
          })
          .then((response) => {
              console.log("Response status:", response.status); // Log the response status for debugging

              if (response.status === 401) {
                  throw new Error("Unauthorized. Please check your credentials.");
              }
              if (response.status === 404) {
                  throw new Error("Publisher not found.");
              }
              if (!response.ok) {
                  throw new Error("Failed to update publisher.");
              }
              return response.json();
          })
          .then((data) => {
              alert("Publisher updated successfully!");
              console.log("Update response:", data);
          })
          .catch((error) => {
              console.error("Update error:", error);
              alert(error.message);
          });
      };

      // Append the approval status dropdown and update button
      contentArea.appendChild(approvalStatusLabel);
      contentArea.appendChild(approvalStatusSelect);
      contentArea.appendChild(document.createElement("br"));
      contentArea.appendChild(updateButton);
  })
  .catch(error => {
      console.error("Error fetching publishers:", error);
      alert("Failed to load publishers.");
  });
}

//Show Publisher Delete Form
function showPublisherDeleteForm() {
  const publisherId = prompt("Enter Publisher ID to delete:");

  if (!publisherId) return;

  if (confirm("Are you sure you want to delete this publisher?")) {
    fetch(`https://accidental-glen-kingfisher.glitch.me/publisher/delete/${publisherId}`, { method: 'DELETE' })
      .then(response => {
        if (!response.ok) throw new Error('Failed to delete publisher.');
        return response.json();
      })
      .then(() => {
        alert('Publisher deleted successfully.');
        fetchPublishers(); // Refresh the table
      })
      .catch(error => console.error('Error deleting publisher:', error));
  }
}


// Fetch and display publishers
function fetchPublishers() {
  const publisherTable = document.getElementById('publisherTable');
  const publisherTableBody = document.getElementById('publisherTableBody');

  if (!publisherTable || !publisherTableBody) {
    console.error('Publisher table or body element not found');
    return;
  }

  fetch('https://accidental-glen-kingfisher.glitch.me/publishers', {  
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch publishers. Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log('Fetched publishers:', data);

      // Clear any existing rows in the table body
      publisherTableBody.innerHTML = '';

      if (data.length === 0) {
        const noPublishersMessage = document.createElement('tr');
        noPublishersMessage.innerHTML = `<td colspan="10" style="text-align: center;">No publishers found.</td>`;
        publisherTableBody.appendChild(noPublishersMessage);
        return;
      }

      // Populate table with publisher data
      data.forEach((publisher) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${publisher.publisher_id}</td>
          <td>${publisher.user_id}</td>
          <td>${publisher.name}</td>
          <td>${publisher.company_name}</td>
          <td>${publisher.phone_number}</td>
          <td>${publisher.address}</td>
          <td>${publisher.legal_document}</td>
          <td>${publisher.approval_status}</td>
          <td>${publisher.approval_date}</td>
          
        `;
        publisherTableBody.appendChild(row);
      });

      publisherTable.style.display = 'table';
    })
    .catch((error) => {
      console.error('Error fetching publishers:', error);
      alert('Failed to fetch publishers. Please check the server and try again.');
    });
}
function fetchCustomers() {
  const customerTable = document.getElementById('customerTable');
  const customerTableBody = document.getElementById('customerTableBody');

  if (!customerTable || !customerTableBody) {
    console.error('Customer table or body element not found');
    return;
  }

  fetch('https://accidental-glen-kingfisher.glitch.me/customers', {  
    method: 'GET',
    headers: {
      'Content-Type': 'application/json'
    }
  })
    .then((response) => {
      if (!response.ok) {
        throw new Error(`Failed to fetch customers. Status: ${response.status}`);
      }
      return response.json();
    })
    .then((data) => {
      console.log('Fetched customers:', data);

      // Clear any existing rows in the table body
      customerTableBody.innerHTML = '';

      if (data.length === 0) {
        const noCustomersMessage = document.createElement('tr');
        noCustomersMessage.innerHTML = `<td colspan="5" style="text-align: center;">No customers found.</td>`;
        customerTableBody.appendChild(noCustomersMessage);
        return;
      }

      // Populate table with customer data
      data.forEach((customer) => {
        const row = document.createElement('tr');
        row.innerHTML = `
          <td>${customer.customer_id}</td>
          <td>${customer.name}</td>
          <td>${customer.email}</td>
          <td>${customer.phone_number}</td>
          <td>${customer.shipping_address}</td>
          <td>${customer.loyalty_points}</td>
        `;
        customerTableBody.appendChild(row);
      });

      customerTable.style.display = 'table';
    })
    .catch((error) => {
      console.error('Error fetching customers:', error);
      alert('Failed to fetch customers. Please check the server and try again.');
    });
}

// Function to fetch and display monthly sales and profit
function showMonthlySales() {
  // Hide other sections
  document.getElementById('publisherForm').style.display = 'none';
  document.getElementById('publisherTable').style.display = 'none';
  document.getElementById('monthlySalesSection').style.display = 'block';

  // Fetch sales data from the backend
  fetch('https://accidental-glen-kingfisher.glitch.me/admin/monthly-sales')
      .then(response => response.json())
      .then(data => {
          console.log('Received data:', data);  // Log the received data for debugging
          if (data.success && Array.isArray(data.salesData)) {
              populateMonthlySalesTable(data.salesData);  // Pass salesData array to the table
          } else {
              alert('No sales data available.');
          }
      })
      .catch(error => {
          console.error('Error fetching sales data:', error);
          alert('Unable to fetch sales data.');
      });
}

// Function to populate the sales table
function populateMonthlySalesTable(salesData) {
  const tableBody = document.getElementById('monthlySalesTableBody');
  tableBody.innerHTML = ''; // Clear previous data

  // Check if the salesData is an array and contains data
  if (Array.isArray(salesData) && salesData.length > 0) {
      salesData.forEach(row => {
          // Ensure the values are treated as numbers
          const totalSales = parseFloat(row.totalSales);
          const adminProfit = parseFloat(row.adminProfit);

          // Check if parsing was successful and if the values are numbers
          if (!isNaN(totalSales) && !isNaN(adminProfit)) {
              const tr = document.createElement('tr');
              tr.innerHTML = `
                  <td>${row.publisherName}</td>
                  <td>${totalSales.toFixed(2)} PKR</td>
                  <td>${adminProfit.toFixed(2)} PKR</td>
              `;
              tableBody.appendChild(tr);
          } else {
              console.error('Invalid data for totalSales or adminProfit:', row);
          }
      });
  } else {
      // Handle the case where no data is available
      tableBody.innerHTML = '<tr><td colspan="3">No sales data available</td></tr>';
  }
}
// Function to display the chart
function showPieChart() {
  // Fetch monthly sales data from the backend
  fetch('https://accidental-glen-kingfisher.glitch.me/admin/monthly-sales')  // Update this URL if necessary
      .then(response => response.json())
      .then(data => {
          if (data.success) {
              updateSalesChart(data.salesData);
          } else {
              alert('No data available for the monthly sales chart.');
          }
      })
      .catch(error => {
          console.error('Error fetching monthly sales data:', error);
          alert('Error fetching sales data.');
      });
}

function updateSalesChart(salesData) {
  const canvas = document.getElementById('salesChart1');
  if (!canvas) {
      console.error('Canvas element not found!');
      return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
      console.error('Failed to get canvas context');
      return;
  }

  // Check if a chart already exists and destroy it
  if (canvas.chart) {
      canvas.chart.destroy();
  }

  // Check if salesData is valid
  if (!Array.isArray(salesData) || salesData.length === 0) {
      console.error('Invalid sales data');
      return;
  }

  // Create a new chart
  canvas.chart = new Chart(ctx, {
      type: 'pie',
      data: {
          labels: salesData.map(item => item.month),
          datasets: [{
              label: 'Monthly Sales',
              data: salesData.map(item => item.sales),
              backgroundColor: [
                  'rgba(54, 162, 235, 0.6)',
                  'rgba(255, 99, 132, 0.6)',
                  'rgba(255, 159, 64, 0.6)',
                  'rgba(75, 192, 192, 0.6)',
                  'rgba(153, 102, 255, 0.6)',
                  'rgba(255, 159, 64, 0.6)',
                  'rgba(255, 99, 132, 0.6)',
                  'rgba(54, 162, 235, 0.6)',
                  'rgba(75, 192, 192, 0.6)',
                  'rgba(153, 102, 255, 0.6)',
              ],
              borderColor: [
                  'rgba(54, 162, 235, 1)',
                  'rgba(255, 99, 132, 1)',
                  'rgba(255, 159, 64, 1)',
                  'rgba(75, 192, 192, 1)',
                  'rgba(153, 102, 255, 1)',
                  'rgba(255, 159, 64, 1)',
                  'rgba(255, 99, 132, 1)',
                  'rgba(54, 162, 235, 1)',
                  'rgba(75, 192, 192, 1)',
                  'rgba(153, 102, 255, 1)',
              ],
              borderWidth: 1
          }]
      },
      options: {
          responsive: true,
          plugins: {
              legend: {
                  position: 'top',
              },
              tooltip: {
                  callbacks: {
                      label: function(tooltipItem) {
                          return `${tooltipItem.label}: ${tooltipItem.raw} units`;
                      }
                  }
              }
          },
          maintainAspectRatio: false
      }
  });
}

function logout() {
  localStorage.removeItem("jwtToken");
  window.location.href = "/index.html";
}

// Initial Fetch of Data
document.addEventListener('DOMContentLoaded', () => {
  fetchPublishers();
  showMonthlySales();
  showPieChart();
});

// Activity Report Controller
angular.module('adminApp')
  .controller('ActivityReportController', ['$scope', '$http', '$window', function($scope, $http, $window) {
    // Get user from localStorage
    const storedUser = $window.localStorage.getItem('user');
    $scope.user = storedUser ? JSON.parse(storedUser) : null;
    
    // Check if user is logged in and is admin
    if (!$scope.user) {
      $window.location.href = '/login';
      return;
    }
    
    // Initialize variables
    $scope.activeTab = 'activity-report';
    $scope.mobileMenuOpen = false;
    $scope.loading = false;
    $scope.noData = false;
    $scope.reportData = {
      summary: {},
      dailyData: {},
      purchasesByCategory: []
    };
    
    // Chart instances
    let dailyActivityChart = null;
    let categoryChart = null;
    let activityPieChart = null;
    
    // Initialize month and year selectors
    const currentDate = new Date();
    $scope.selectedMonth = currentDate.getMonth() + 1;
    $scope.selectedYear = currentDate.getFullYear();
    
    // Generate months array
    $scope.months = [
      { value: 1, name: 'January' },
      { value: 2, name: 'February' },
      { value: 3, name: 'March' },
      { value: 4, name: 'April' },
      { value: 5, name: 'May' },
      { value: 6, name: 'June' },
      { value: 7, name: 'July' },
      { value: 8, name: 'August' },
      { value: 9, name: 'September' },
      { value: 10, name: 'October' },
      { value: 11, name: 'November' },
      { value: 12, name: 'December' }
    ];
    
    // Generate years array (last 3 years)
    $scope.years = [];
    for (let i = 0; i < 3; i++) {
      $scope.years.push(currentDate.getFullYear() - i);
    }
    
    // Navigation functions
    $scope.setActiveTab = function(tab) {
      $scope.activeTab = tab;
      
      if (window.innerWidth <= 768) {
        $scope.mobileMenuOpen = false;
      }
      
      switch(tab) {
        case 'user-book-manager':
          $window.location.href = '/user-book-manager';
          break;
        case 'mssgAdmin':
          $window.location.href = '/mssgAdmin';
          break;
        case 'adminAccount':
          $window.location.href = '/adminAccount';
          break;
      }
    };
    
    $scope.toggleMobileMenu = function() {
      $scope.mobileMenuOpen = !$scope.mobileMenuOpen;
    };
    
    $scope.logout = function() {
      $window.localStorage.removeItem('user');
      $window.location.href = '/login';
    };
    
    // Load report data
    $scope.updateReport = function() {
      $scope.loading = true;
      $scope.noData = false;
      
      $http.get('/api/admin/activity-report', {
        params: {
          userId: $scope.user.id,
          year: $scope.selectedYear,
          month: $scope.selectedMonth
        }
      })
      .then(function(response) {
        if (response.data.success) {
          $scope.reportData = response.data.data;
          
          // Check if there's any data
          if ($scope.reportData.summary.totalUsers === 0 && 
              $scope.reportData.summary.totalBooks === 0 && 
              $scope.reportData.summary.totalPurchases === 0) {
            $scope.noData = true;
          } else {
            updateCharts();
          }
        }
        $scope.loading = false;
      })
      .catch(function(error) {
        console.error('Error loading report:', error);
        alert('Error loading activity report. Please try again later.');
        $scope.loading = false;
      });
    };
    
    // Update charts with new data
    function updateCharts() {
      // Prepare data for daily activity chart
      const daysInMonth = new Date($scope.selectedYear, $scope.selectedMonth, 0).getDate();
      const labels = [];
      const usersData = new Array(daysInMonth).fill(0);
      const booksData = new Array(daysInMonth).fill(0);
      const purchasesData = new Array(daysInMonth).fill(0);
      
      // Generate labels for all days in the month
      for (let i = 1; i <= daysInMonth; i++) {
        labels.push(i.toString());
      }
      
      // Fill in the data
      $scope.reportData.dailyData.users.forEach(item => {
        const day = new Date(item.date).getDate();
        usersData[day - 1] = parseInt(item.count);
      });
      
      $scope.reportData.dailyData.books.forEach(item => {
        const day = new Date(item.date).getDate();
        booksData[day - 1] = parseInt(item.count);
      });
      
      $scope.reportData.dailyData.purchases.forEach(item => {
        const day = new Date(item.date).getDate();
        purchasesData[day - 1] = parseInt(item.count);
      });
      
      // Update Daily Activity Chart
      const dailyCtx = document.getElementById('dailyActivityChart').getContext('2d');
      if (dailyActivityChart) {
        dailyActivityChart.destroy();
      }
      
      dailyActivityChart = new Chart(dailyCtx, {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'New Users',
              data: usersData,
              borderColor: '#4CAF50',
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              tension: 0.3
            },
            {
              label: 'Books Uploaded',
              data: booksData,
              borderColor: '#2196F3',
              backgroundColor: 'rgba(33, 150, 243, 0.1)',
              tension: 0.3
            },
            {
              label: 'Purchases',
              data: purchasesData,
              borderColor: '#FF9800',
              backgroundColor: 'rgba(255, 152, 0, 0.1)',
              tension: 0.3
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
            },
            title: {
              display: false
            }
          },
          scales: {
            y: {
              beginAtZero: true,
              ticks: {
                stepSize: 1
              }
            }
          }
        }
      });
      
      // Update Category Chart
      const categoryCtx = document.getElementById('categoryChart').getContext('2d');
      if (categoryChart) {
        categoryChart.destroy();
      }
      
      const categoryLabels = $scope.reportData.purchasesByCategory.map(item => item.category);
      const categoryData = $scope.reportData.purchasesByCategory.map(item => parseInt(item.count));
      
      categoryChart = new Chart(categoryCtx, {
        type: 'doughnut',
        data: {
          labels: categoryLabels.length > 0 ? categoryLabels : ['No Data'],
          datasets: [{
            data: categoryData.length > 0 ? categoryData : [1],
            backgroundColor: [
              '#FF6384',
              '#36A2EB',
              '#FFCE56',
              '#4BC0C0',
              '#9966FF',
              '#FF9F40'
            ]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
            }
          }
        }
      });
      
      // Update Activity Pie Chart
      const pieCtx = document.getElementById('activityPieChart').getContext('2d');
      if (activityPieChart) {
        activityPieChart.destroy();
      }
      
      activityPieChart = new Chart(pieCtx, {
        type: 'pie',
        data: {
          labels: ['New Users', 'Books Uploaded', 'Purchases'],
          datasets: [{
            data: [
              $scope.reportData.summary.totalUsers,
              $scope.reportData.summary.totalBooks,
              $scope.reportData.summary.totalPurchases
            ],
            backgroundColor: [
              '#4CAF50',
              '#2196F3',
              '#FF9800'
            ]
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
            }
          }
        }
      });
    }
    
    // Initial load
    $scope.updateReport();
  }]);
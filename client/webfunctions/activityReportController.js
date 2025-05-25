// Activity Report Controller - Fixed Version
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
    
    // Initialize month and year selectors - Set to current month/year
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
      
      // Destroy existing charts before loading new data
      destroyAllCharts();
      
      $http.get('/api/admin/activity-report', {
        params: {
          userId: $scope.user.id,
          year: $scope.selectedYear,
          month: $scope.selectedMonth
        }
      })
      .then(function(response) {
        if (response.data.success) {
          // Reset report data first
          $scope.reportData = {
            summary: response.data.data.summary || {},
            dailyData: response.data.data.dailyData || { users: [], books: [], purchases: [] },
            purchasesByCategory: response.data.data.purchasesByCategory || []
          };
          
          // Check if there's any data
          if (($scope.reportData.summary.totalUsers || 0) === 0 && 
              ($scope.reportData.summary.totalBooks || 0) === 0 && 
              ($scope.reportData.summary.totalPurchases || 0) === 0) {
            $scope.noData = true;
          } else {
            $scope.noData = false;
            // Use setTimeout to ensure DOM is ready
            setTimeout(function() {
              updateCharts();
            }, 100);
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
    
    // Helper function to destroy all charts
    function destroyAllCharts() {
      if (dailyActivityChart) {
        dailyActivityChart.destroy();
        dailyActivityChart = null;
      }
      if (categoryChart) {
        categoryChart.destroy();
        categoryChart = null;
      }
      if (activityPieChart) {
        activityPieChart.destroy();
        activityPieChart = null;
      }
    }
    
    // Helper function to calculate percentages
    function calculatePercentages(data) {
      const total = data.reduce((sum, value) => sum + value, 0);
      return data.map(value => total > 0 ? ((value / total) * 100).toFixed(1) : 0);
    }
    
    // Update charts with new data
    function updateCharts() {
      try {
        updateDailyActivityChart();
        updateCategoryChart();
        updateActivityPieChart();
      } catch (error) {
        console.error('Error updating charts:', error);
      }
    }
    
    function updateDailyActivityChart() {
      const dailyCtx = document.getElementById('dailyActivityChart');
      if (!dailyCtx) return;
      
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
      
      // Fill in the data - with null checks
      if ($scope.reportData.dailyData.users) {
        $scope.reportData.dailyData.users.forEach(item => {
          const day = new Date(item.date).getDate();
          if (day >= 1 && day <= daysInMonth) {
            usersData[day - 1] = parseInt(item.count) || 0;
          }
        });
      }
      
      if ($scope.reportData.dailyData.books) {
        $scope.reportData.dailyData.books.forEach(item => {
          const day = new Date(item.date).getDate();
          if (day >= 1 && day <= daysInMonth) {
            booksData[day - 1] = parseInt(item.count) || 0;
          }
        });
      }
      
      if ($scope.reportData.dailyData.purchases) {
        $scope.reportData.dailyData.purchases.forEach(item => {
          const day = new Date(item.date).getDate();
          if (day >= 1 && day <= daysInMonth) {
            purchasesData[day - 1] = parseInt(item.count) || 0;
          }
        });
      }
      
      // Get month name for display
      const monthName = $scope.months.find(m => m.value === $scope.selectedMonth).name;
      
      dailyActivityChart = new Chart(dailyCtx.getContext('2d'), {
        type: 'line',
        data: {
          labels: labels,
          datasets: [
            {
              label: 'New Users',
              data: usersData,
              borderColor: '#4CAF50',
              backgroundColor: 'rgba(76, 175, 80, 0.1)',
              tension: 0.3,
              fill: true,
              borderWidth: 2
            },
            {
              label: 'Books Uploaded',
              data: booksData,
              borderColor: '#2196F3',
              backgroundColor: 'rgba(33, 150, 243, 0.1)',
              tension: 0.3,
              fill: true,
              borderWidth: 2
            },
            {
              label: 'Purchases',
              data: purchasesData,
              borderColor: '#FF9800',
              backgroundColor: 'rgba(255, 152, 0, 0.1)',
              tension: 0.3,
              fill: true,
              borderWidth: 2
            }
          ]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'top',
              labels: {
                usePointStyle: true,
                padding: 15,
                font: {
                  size: 13
                }
              }
            },
            title: {
              display: true,
              text: `Daily Activity for ${monthName} ${$scope.selectedYear}`,
              font: {
                size: 16,
                weight: 'bold'
              },
              padding: {
                top: 10,
                bottom: 30
              }
            }
          },
          scales: {
            x: {
              display: true,
              title: {
                display: true,
                text: `Days of ${monthName}`,
                font: {
                  size: 14,
                  weight: 'bold'
                },
                padding: {
                  top: 10,
                  bottom: 0
                }
              },
              grid: {
                display: true,
                color: 'rgba(0, 0, 0, 0.05)',
                drawBorder: false
              },
              ticks: {
                font: {
                  size: 12
                }
              }
            },
            y: {
              display: true,
              beginAtZero: true,
              title: {
                display: true,
                text: 'Number of Activities',
                font: {
                  size: 14,
                  weight: 'bold'
                },
                padding: {
                  top: 0,
                  bottom: 10
                }
              },
              ticks: {
                stepSize: 1,
                font: {
                  size: 12
                }
              },
              grid: {
                display: true,
                color: 'rgba(0, 0, 0, 0.05)',
                drawBorder: false
              }
            }
          }
        }
      });
    }
    
    function updateCategoryChart() {
      const categoryCtx = document.getElementById('categoryChart');
      if (!categoryCtx) return;
      
      const categoryLabels = ($scope.reportData.purchasesByCategory || []).map(item => item.category);
      const categoryData = ($scope.reportData.purchasesByCategory || []).map(item => parseInt(item.count) || 0);
      const categoryPercentages = calculatePercentages(categoryData);
      
      // Handle empty data
      const hasData = categoryData.length > 0 && categoryData.some(val => val > 0);
      const chartLabels = hasData ? categoryLabels : ['No Data'];
      const chartData = hasData ? categoryData : [1];
      const chartColors = hasData ? [
        '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0', 
        '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF'
      ] : ['#E0E0E0'];
      
      categoryChart = new Chart(categoryCtx.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: chartLabels,
          datasets: [{
            data: chartData,
            backgroundColor: chartColors,
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding: 15,
                font: {
                  size: 13
                },
                generateLabels: function(chart) {
                  const data = chart.data;
                  if (data.labels.length && data.datasets.length && hasData) {
                    return data.labels.map((label, index) => {
                      const value = data.datasets[0].data[index];
                      const percentage = categoryPercentages[index];
                      return {
                        text: `${label} (${percentage}%)`,
                        fillStyle: data.datasets[0].backgroundColor[index],
                        hidden: false,
                        index: index
                      };
                    });
                  }
                  return [{
                    text: 'No Data Available',
                    fillStyle: '#E0E0E0',
                    hidden: false,
                    index: 0
                  }];
                }
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  if (!hasData) return 'No data available';
                  const label = context.label || '';
                  const value = context.parsed;
                  const percentage = categoryPercentages[context.dataIndex];
                  return `${label}: ${value} purchases (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }
    
    function updateActivityPieChart() {
      const pieCtx = document.getElementById('activityPieChart');
      if (!pieCtx) return;
      
      const activityData = [
        $scope.reportData.summary.totalUsers || 0,
        $scope.reportData.summary.totalBooks || 0,
        $scope.reportData.summary.totalPurchases || 0
      ];
      const activityPercentages = calculatePercentages(activityData);
      const hasData = activityData.some(val => val > 0);
      
      activityPieChart = new Chart(pieCtx.getContext('2d'), {
        type: 'pie',
        data: {
          labels: hasData ? ['New Users', 'Books Uploaded', 'Purchases'] : ['No Data'],
          datasets: [{
            data: hasData ? activityData : [1],
            backgroundColor: hasData ? ['#4CAF50', '#2196F3', '#FF9800'] : ['#E0E0E0'],
            borderWidth: 2,
            borderColor: '#fff'
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                padding: 15,
                font: {
                  size: 13
                },
                generateLabels: function(chart) {
                  const data = chart.data;
                  if (data.labels.length && data.datasets.length && hasData) {
                    return data.labels.map((label, index) => {
                      const value = data.datasets[0].data[index];
                      const percentage = activityPercentages[index];
                      return {
                        text: `${label}: ${value} (${percentage}%)`,
                        fillStyle: data.datasets[0].backgroundColor[index],
                        hidden: false,
                        index: index
                      };
                    });
                  }
                  return [{
                    text: 'No Data Available',
                    fillStyle: '#E0E0E0',
                    hidden: false,
                    index: 0
                  }];
                }
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  if (!hasData) return 'No data available';
                  const label = context.label || '';
                  const value = context.parsed;
                  const percentage = activityPercentages[context.dataIndex];
                  return `${label}: ${value} (${percentage}%)`;
                }
              }
            }
          }
        }
      });
    }
    
    // Cleanup function
    $scope.$on('$destroy', function() {
      destroyAllCharts();
    });
    
    // Initial load - will automatically use current month/year
    $scope.updateReport();
  }]);
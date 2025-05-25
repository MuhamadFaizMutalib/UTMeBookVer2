// Activity Report Controller - Updated with Enhanced Chart Labels and Percentages
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
    
    // Helper function to calculate percentages
    function calculatePercentages(data) {
      const total = data.reduce((sum, value) => sum + value, 0);
      return data.map(value => total > 0 ? ((value / total) * 100).toFixed(1) : 0);
    }
    
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
      
      // Update Daily Activity Chart with enhanced axis labels
      const dailyCtx = document.getElementById('dailyActivityChart').getContext('2d');
      if (dailyActivityChart) {
        dailyActivityChart.destroy();
      }
      
      // Get month name for display
      const monthName = $scope.months.find(m => m.value === $scope.selectedMonth).name;
      
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
      
      // Update Category Chart with enhanced percentages
      const categoryCtx = document.getElementById('categoryChart').getContext('2d');
      if (categoryChart) {
        categoryChart.destroy();
      }
      
      const categoryLabels = $scope.reportData.purchasesByCategory.map(item => item.category);
      const categoryData = $scope.reportData.purchasesByCategory.map(item => parseInt(item.count));
      const categoryPercentages = calculatePercentages(categoryData);
      
      // Create custom plugin for displaying percentages
      const categoryPercentagePlugin = {
        id: 'categoryPercentages',
        afterDatasetsDraw: function(chart) {
          const ctx = chart.ctx;
          ctx.save();
          
          const dataset = chart.data.datasets[0];
          const meta = chart.getDatasetMeta(0);
          
          meta.data.forEach((element, index) => {
            // Get the percentage value
            const percentage = categoryPercentages[index];
            
            // Only display if percentage is greater than 3%
            if (percentage > 3) {
              // Calculate position
              const { x, y } = element.tooltipPosition();
              
              // Draw white background for better readability
              ctx.fillStyle = 'white';
              ctx.strokeStyle = '#333';
              ctx.lineWidth = 2;
              ctx.font = 'bold 14px Arial';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              
              const text = `${percentage}%`;
              const textWidth = ctx.measureText(text).width;
              const padding = 6;
              
              // Draw background
              ctx.beginPath();
              ctx.roundRect(x - textWidth/2 - padding, y - 10, textWidth + padding*2, 20, 5);
              ctx.fill();
              ctx.stroke();
              
              // Draw text
              ctx.fillStyle = '#333';
              ctx.fillText(text, x, y);
            }
          });
          
          ctx.restore();
        }
      };
      
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
              '#FF9F40',
              '#FF6384',
              '#C9CBCF'
            ],
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
                  if (data.labels.length && data.datasets.length) {
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
                  return [];
                }
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.parsed;
                  const percentage = categoryPercentages[context.dataIndex];
                  return `${label}: ${value} purchases (${percentage}%)`;
                }
              }
            }
          }
        },
        plugins: [categoryPercentagePlugin]
      });
      
      // Update Activity Pie Chart with enhanced percentages
      const pieCtx = document.getElementById('activityPieChart').getContext('2d');
      if (activityPieChart) {
        activityPieChart.destroy();
      }
      
      const activityData = [
        $scope.reportData.summary.totalUsers,
        $scope.reportData.summary.totalBooks,
        $scope.reportData.summary.totalPurchases
      ];
      const activityPercentages = calculatePercentages(activityData);
      
      // Create custom plugin for activity pie chart
      const activityPercentagePlugin = {
        id: 'activityPercentages',
        afterDatasetsDraw: function(chart) {
          const ctx = chart.ctx;
          ctx.save();
          
          const dataset = chart.data.datasets[0];
          const meta = chart.getDatasetMeta(0);
          
          meta.data.forEach((element, index) => {
            const percentage = activityPercentages[index];
            
            if (percentage > 0) {
              const { x, y } = element.tooltipPosition();
              
              // Draw percentage with background
              ctx.fillStyle = 'white';
              ctx.strokeStyle = '#333';
              ctx.lineWidth = 2;
              ctx.font = 'bold 16px Arial';
              ctx.textAlign = 'center';
              ctx.textBaseline = 'middle';
              
              const text = `${percentage}%`;
              const textWidth = ctx.measureText(text).width;
              const padding = 8;
              
              // Draw background
              ctx.beginPath();
              ctx.roundRect(x - textWidth/2 - padding, y - 12, textWidth + padding*2, 24, 5);
              ctx.fill();
              ctx.stroke();
              
              // Draw text
              ctx.fillStyle = '#333';
              ctx.fillText(text, x, y);
            }
          });
          
          ctx.restore();
        }
      };
      
      activityPieChart = new Chart(pieCtx, {
        type: 'pie',
        data: {
          labels: ['New Users', 'Books Uploaded', 'Purchases'],
          datasets: [{
            data: activityData,
            backgroundColor: [
              '#4CAF50',
              '#2196F3',
              '#FF9800'
            ],
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
                  if (data.labels.length && data.datasets.length) {
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
                  return [];
                }
              }
            },
            tooltip: {
              callbacks: {
                label: function(context) {
                  const label = context.label || '';
                  const value = context.parsed;
                  const percentage = activityPercentages[context.dataIndex];
                  return `${label}: ${value} (${percentage}%)`;
                }
              }
            }
          }
        },
        plugins: [activityPercentagePlugin]
      });
    }
    
    // Add polyfill for roundRect if not supported
    if (!CanvasRenderingContext2D.prototype.roundRect) {
      CanvasRenderingContext2D.prototype.roundRect = function(x, y, width, height, radius) {
        if (width < 2 * radius) radius = width / 2;
        if (height < 2 * radius) radius = height / 2;
        this.beginPath();
        this.moveTo(x + radius, y);
        this.arcTo(x + width, y, x + width, y + height, radius);
        this.arcTo(x + width, y + height, x, y + height, radius);
        this.arcTo(x, y + height, x, y, radius);
        this.arcTo(x, y, x + width, y, radius);
        this.closePath();
        return this;
      };
    }
    
    // Initial load - will automatically use current month/year
    $scope.updateReport();
  }]);
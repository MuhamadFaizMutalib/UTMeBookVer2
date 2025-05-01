// Update the existing dashboardApp.js to include book functionality
angular.module('dashboardApp', [])
  .controller('DashboardController', ['$scope', '$http', '$window', function($scope, $http, $window) {
    // Get user information from localStorage
    try {
      $scope.user = JSON.parse($window.localStorage.getItem('user'));
      
      // Redirect to login if user not found
      if (!$scope.user) {
        $window.location.href = '/login';
      }
    } catch (error) {
      console.error('Error getting user data:', error);
      $window.location.href = '/login';
    }
    
    // Mobile menu state
    $scope.mobileMenuOpen = false;
    
    // Toggle mobile menu
    $scope.toggleMobileMenu = function() {
      $scope.mobileMenuOpen = !$scope.mobileMenuOpen;
    };
    
    // Get tab from URL if present
    let urlParams = new URLSearchParams(window.location.search);
    let tabParam = urlParams.get('tab');
    
    // Active tab (default: main dashboard or from URL parameter)
    $scope.activeTab = tabParam || 'dashboard';
    
    // Function to set active tab and handle navigation
    $scope.setActiveTab = function(tab) {
      $scope.activeTab = tab;
      
      // If on mobile, close the menu after selecting an item
      if (window.innerWidth <= 768) {
        $scope.mobileMenuOpen = false;
      }
      
      // Navigate to the appropriate page based on the tab
      switch(tab) {
        case 'add-ebook':
          $window.location.href = '/add-ebook';
          break;
        case 'order':
          $window.location.href = '/order';
          break;
        case 'messages':
          $window.location.href = '/messages';
          break;
        case 'mybook':
          $window.location.href = '/mybook';
          break;
        case 'account':
          $window.location.href = '/account';
          break;
        default:
          // Stay on dashboard for other tabs
          break;
      }
    };
    
    // Check if tab parameter is 'order' and load data
    if (tabParam === 'order') {
      loadMySales();
      loadMyPurchases();
    }
    
    // Search functionality
    $scope.searchQuery = '';
    $scope.searchFilter = {
      category: '',
      sortBy: 'relevance'
    };
    
    $scope.searchBooks = function() {
      console.log('Searching for:', $scope.searchQuery);
      console.log('Filters:', $scope.searchFilter);
      
      // In a real app, this would send a request to the server
      // For now, we'll just log the search parameters
      
      // Close mobile menu after search (if on mobile)
      if (window.innerWidth <= 768) {
        $scope.mobileMenuOpen = false;
      }
    };
    
    // Initialize arrays for books
    $scope.newArrivals = [];
    $scope.mySales = [];
    $scope.myPurchases = [];
    
    // Load new arrivals
    function loadNewArrivals() {
      $http.get('/api/books/new-arrivals')
        .then(function(response) {
          if (response.data.success) {
            $scope.newArrivals = response.data.books;
          } else {
            console.error('Error loading new arrivals:', response.data.message);
          }
        })
        .catch(function(error) {
          console.error('Error loading new arrivals:', error);
        });
    }
    
    // Load my sales (for order page)
    function loadMySales() {
      $http.get('/api/books/my-sales/' + $scope.user.id)
        .then(function(response) {
          if (response.data.success) {
            $scope.mySales = response.data.books;
          } else {
            console.error('Error loading my sales:', response.data.message);
          }
        })
        .catch(function(error) {
          console.error('Error loading my sales:', error);
        });
    }
    
    // Load my purchases (for order page)
    function loadMyPurchases() {
      $http.get('/api/books/my-purchases/' + $scope.user.id)
        .then(function(response) {
          if (response.data.success) {
            $scope.myPurchases = response.data.purchases;
          } else {
            console.error('Error loading my purchases:', response.data.message);
          }
        })
        .catch(function(error) {
          console.error('Error loading my purchases:', error);
        });
    }
    
    // Load new arrivals on page load
    loadNewArrivals();
    
    // Function to add book to cart
    $scope.addToCart = function(book) {
      console.log('Adding to cart:', book.title);
      
      // Create toast notification
      showToast('Added "' + book.title + '" to cart', 'success');
    };
    
    // Function to edit book
    // $scope.editBook = function(book) {
    //   console.log('Editing book:', book.id);
    //   $window.location.href = '/edit-book?id=' + book.id;
    // };
    
    // Function to delete book
    $scope.deleteBook = function(book) {
      if (confirm('Are you sure you want to delete "' + book.title + '"? This action cannot be undone.')) {
        $http.delete('/api/books/' + book.id + '?sellerId=' + $scope.user.id)
          .then(function(response) {
            if (response.data.success) {
              // Remove book from the sales list
              $scope.mySales = $scope.mySales.filter(function(b) {
                return b.id !== book.id;
              });
              
              showToast('Book deleted successfully', 'success');
            } else {
              showToast('Error: ' + response.data.message, 'error');
            }
          })
          .catch(function(error) {
            console.error('Error deleting book:', error);
            showToast('Server error. Please try again later.', 'error');
          });
      }
    };
    
    // Helper function to show toast notifications
    function showToast(message, type) {
      // Create toast element
      var toast = document.createElement('div');
      toast.className = 'toast-notification';
      
      // Set icon based on type
      var icon = '';
      if (type === 'success') {
        icon = '<i class="fas fa-check-circle"></i>';
      } else if (type === 'heart') {
        icon = '<i class="fas fa-heart"></i>';
      } else if (type === 'info') {
        icon = '<i class="fas fa-info-circle"></i>';
      } else if (type === 'error') {
        icon = '<i class="fas fa-exclamation-circle"></i>';
      }
      
      toast.innerHTML = icon + ' ' + message;
      document.body.appendChild(toast);
      
      // Show toast
      setTimeout(function() {
        toast.classList.add('show');
      }, 100);
      
      // Hide and remove toast
      setTimeout(function() {
        toast.classList.remove('show');
        setTimeout(function() {
          document.body.removeChild(toast);
        }, 300);
      }, 3000);
    }
    
    // Logout function
    $scope.logout = function() {
      if (confirm('Are you sure you want to logout?')) {
        // Clear user data from localStorage
        $window.localStorage.removeItem('user');
        
        // Redirect to login page
        $window.location.href = '/login';
      }
    };
    
    // Adjust mobile menu on window resize
    angular.element($window).bind('resize', function() {
      if (window.innerWidth > 768 && $scope.mobileMenuOpen) {
        $scope.mobileMenuOpen = false;
        if (!$scope.$$phase) {
          $scope.$apply();
        }
      }
    });
  }]);
// Angular.js application for the mybook page
angular.module('myBookApp', [])
  .controller('MyBookController', ['$scope', '$http', '$window', function($scope, $http, $window) {
    // Get user information from localStorage
    try {
      $scope.user = JSON.parse($window.localStorage.getItem('user'));
      
      // Redirect to login if user not found
      if (!$scope.user) {
        $window.location.href = '/login';
        return;
      }
    } catch (error) {
      console.error('Error getting user data:', error);
      $window.location.href = '/login';
      return;
    }
    
    // Mobile menu state
    $scope.mobileMenuOpen = false;
    
    // Initialize array for delivered books
    $scope.myDeliveredBooks = [];

    // Toggle mobile menu
    $scope.toggleMobileMenu = function() {
      $scope.mobileMenuOpen = !$scope.mobileMenuOpen;
    };
    
    // Function to set active tab and handle navigation
    $scope.setActiveTab = function(tab) {
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
        case 'account':
          $window.location.href = '/account';
          break;
        case 'dashboard':
          $window.location.href = '/dashboard';
          break;
        default:
          // Stay on current page for other tabs
          break;
      }
    };
    
    // Load user's delivered books
    function loadMyDeliveredBooks() {
      $http.get('/api/purchases/my-purchases/' + $scope.user.id)
        .then(function(response) {
          if (response.data.success) {
            // Filter only delivered books
            $scope.myDeliveredBooks = response.data.purchases.filter(function(purchase) {
              return purchase.status === 'Delivered';
            });
          } else {
            console.error('Error loading my books:', response.data.message);
            showToast('Error loading your books', 'error');
          }
        })
        .catch(function(error) {
          console.error('Error loading my books:', error);
          showToast('Server error. Please try again later.', 'error');
        });
    }
    
    // Function to download encrypted book
    $scope.downloadEncryptedBook = function(book) {
      $http.get('/api/encrypted/download/' + book.orderId)
        .then(function(response) {
          if (response.data.success) {
            // Create a link element and trigger download
            const downloadUrl = response.data.downloadUrl;
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = book.title + '.pdf';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            showToast('Download started', 'success');
          } else {
            showToast('Error: ' + response.data.message, 'error');
          }
        })
        .catch(function(error) {
          console.error('Error downloading book:', error);
          showToast('Server error. Please try again later.', 'error');
        });
    };
    
    // Logout function
    $scope.logout = function() {
      if (confirm('Are you sure you want to logout?')) {
        // Clear user data from localStorage
        $window.localStorage.removeItem('user');
        
        // Redirect to login page
        $window.location.href = '/login';
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
    
    // Adjust mobile menu on window resize
    angular.element($window).bind('resize', function() {
      if (window.innerWidth > 768 && $scope.mobileMenuOpen) {
        $scope.mobileMenuOpen = false;
        if (!$scope.$$phase) {
          $scope.$apply();
        }
      }
    });
    
    // Load data on page load
    loadMyDeliveredBooks();
  }]);
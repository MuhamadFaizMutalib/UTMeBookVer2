// Angular.js application for the messages page
angular.module('messagesApp', [])
  .controller('MessagesController', ['$scope', '$http', '$window', '$sce', function($scope, $http, $window, $sce) {
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
    
    // Modal states
    $scope.showMessageModal = false;
    $scope.showPurchaseModal = false;
    
    // Selected items
    $scope.selectedMessage = {};
    $scope.selectedPurchase = {};
    
    // Initialize arrays for the messages page
    $scope.messages = [];
    $scope.allPurchases = [];
    
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
        case 'mybook':
          $window.location.href = '/mybook';
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
    
    // Load user's messages
    function loadMessages() {
      $http.get('/api/messages/' + $scope.user.id)
        .then(function(response) {
          if (response.data.success) {
            $scope.messages = response.data.messages;
          } else {
            console.error('Error loading messages:', response.data.message);
            showToast('Error loading your messages', 'error');
          }
        })
        .catch(function(error) {
          console.error('Error loading messages:', error);
          showToast('Server error. Please try again later.', 'error');
        });
    }
    
    // For admin, load all purchases
    function loadAllPurchases() {
      if ($scope.user.role === 'admin') {
        $http.get('/api/admin/purchases', { params: { userId: $scope.user.id } })
          .then(function(response) {
            if (response.data.success) {
              $scope.allPurchases = response.data.purchases;
            } else {
              console.error('Error loading purchases:', response.data.message);
              showToast('Error loading purchases', 'error');
            }
          })
          .catch(function(error) {
            console.error('Error loading purchases:', error);
            showToast('Server error. Please try again later.', 'error');
          });
      }
    }
    
    // Function to view message
    $scope.viewMessage = function(message) {
      $scope.selectedMessage = message;
      $scope.showMessageModal = true;
      
      // Mark message as read if it's unread
      if (!message.isRead) {
        $http.put('/api/messages/' + message.id + '/read', { userId: $scope.user.id })
          .then(function(response) {
            if (response.data.success) {
              message.isRead = true;
            }
          })
          .catch(function(error) {
            console.error('Error marking message as read:', error);
          });
      }
    };
    
    // Close message modal
    $scope.closeMessageModal = function() {
      $scope.showMessageModal = false;
    };
    
    // Function to view purchase details
    $scope.viewPurchaseDetails = function(purchase) {
      $scope.selectedPurchase = {...purchase, newStatus: purchase.status};
      $scope.showPurchaseModal = true;
    };
    
    // Close purchase modal
    $scope.closePurchaseModal = function() {
      $scope.showPurchaseModal = false;
    };
    
    // Update purchase status
    $scope.updateStatus = function() {
      // Check if status has changed
      if ($scope.selectedPurchase.newStatus === $scope.selectedPurchase.status) {
        showToast('Status is already ' + $scope.selectedPurchase.status, 'info');
        return;
      }
      
      // Send update to server
      $http.put('/api/admin/purchases/update-status/' + $scope.selectedPurchase.orderId, {
        userId: $scope.user.id,
        newStatus: $scope.selectedPurchase.newStatus
      }).then(function(response) {
        if (response.data.success) {
          // Update status in the list
          for (var i = 0; i < $scope.allPurchases.length; i++) {
            if ($scope.allPurchases[i].orderId === $scope.selectedPurchase.orderId) {
              $scope.allPurchases[i].status = $scope.selectedPurchase.newStatus;
              break;
            }
          }
          
          // Update selected purchase
          $scope.selectedPurchase.status = $scope.selectedPurchase.newStatus;
          
          showToast('Status updated successfully', 'success');
        } else {
          showToast('Error: ' + response.data.message, 'error');
        }
      }).catch(function(error) {
        console.error('Error updating status:', error);
        showToast('Server error. Please try again later.', 'error');
      });
    };
    
    // Function to open update status dialog
    $scope.updateOrderStatus = function(purchase) {
      $scope.viewPurchaseDetails(purchase);
    };
    
    // Filter to convert new lines to <br> tags
    $scope.nl2br = function(text) {
      if (!text) return '';
      return $sce.trustAsHtml(text.replace(/\n/g, '<br>'));
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
    
    // Load data on page load
    loadMessages();
    loadAllPurchases();
    
    
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
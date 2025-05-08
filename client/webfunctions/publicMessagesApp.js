// Angular.js application for the public messages/notifications page
angular.module('publicMessagesApp', [])
  .filter('nl2br', function($sce) {
    return function(text) {
      if (!text) return '';
      return $sce.trustAsHtml(text.replace(/\n/g, '<br>'));
    };
  })
  .controller('PublicMessagesController', ['$scope', '$http', '$window', '$sce', '$filter', function($scope, $http, $window, $sce, $filter) {
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
    
    // Modal state
    $scope.showNotificationModal = false;
    
    // Selected notification
    $scope.selectedNotification = {};
    
    // Initialize notifications array and filter options
    $scope.notifications = [];
    $scope.filteredNotifications = [];
    $scope.filter = 'all';
    $scope.unreadCount = 0;
    $scope.hasUnread = false;
    
    // Toggle mobile menu
    $scope.toggleMobileMenu = function() {
      $scope.mobileMenuOpen = !$scope.mobileMenuOpen;
    };
    
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
        case 'dashboard':
          $window.location.href = '/dashboard';
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
    
    // Load user's notifications
    function loadNotifications() {
      $http.get('/api/public-messages/' + $scope.user.id)
        .then(function(response) {
          if (response.data.success) {
            $scope.notifications = response.data.notifications;
            
            // Count unread notifications
            $scope.unreadCount = $scope.notifications.filter(notification => !notification.isRead).length;
            $scope.hasUnread = $scope.unreadCount > 0;
            
            // Apply current filter
            applyFilter();
          } else {
            console.error('Error loading notifications:', response.data.message);
            showToast('Error loading your notifications', 'error');
          }
        })
        .catch(function(error) {
          console.error('Error loading notifications:', error);
          showToast('Server error. Please try again later.', 'error');
        });
    }
    
    // Set notification filter
    $scope.setFilter = function(filter) {
      $scope.filter = filter;
      applyFilter();
    };
    
    // Apply the current filter to notifications
    function applyFilter() {
      switch($scope.filter) {
        case 'unread':
          $scope.filteredNotifications = $scope.notifications.filter(notification => !notification.isRead);
          break;
        case 'orders':
          $scope.filteredNotifications = $scope.notifications.filter(notification => notification.messageType === 'order');
          break;
        case 'system':
          $scope.filteredNotifications = $scope.notifications.filter(notification => notification.messageType === 'system');
          break;
        default:
          // 'all' filter or any other value
          $scope.filteredNotifications = $scope.notifications;
          break;
      }
    }
    
    // Get appropriate empty message based on current filter
    $scope.getEmptyMessage = function() {
      switch($scope.filter) {
        case 'unread':
          return 'You have no unread notifications.';
        case 'orders':
          return 'You have no order notifications.';
        case 'system':
          return 'You have no system notifications.';
        default:
          return 'You have no notifications.';
      }
    };
    
    // Function to view notification
    $scope.viewNotification = function(notification) {
      $scope.selectedNotification = notification;
      $scope.showNotificationModal = true;
      
      // Mark notification as read if it's unread
      if (!notification.isRead) {
        $http.put('/api/public-messages/' + notification.id + '/read', { userId: $scope.user.id })
          .then(function(response) {
            if (response.data.success) {
              notification.isRead = true;
              
              // Update unread count
              $scope.unreadCount = Math.max(0, $scope.unreadCount - 1);
              $scope.hasUnread = $scope.unreadCount > 0;
            }
          })
          .catch(function(error) {
            console.error('Error marking notification as read:', error);
          });
      }
    };
    
    // Close notification modal
    $scope.closeNotificationModal = function() {
      $scope.showNotificationModal = false;
    };
    
    // Mark all notifications as read
    $scope.markAllAsRead = function() {
      if (!$scope.hasUnread) return;
      
      $http.put('/api/public-messages/mark-all-read', { userId: $scope.user.id })
        .then(function(response) {
          if (response.data.success) {
            // Update all notifications to read
            $scope.notifications.forEach(notification => {
              notification.isRead = true;
            });
            
            // Update unread count
            $scope.unreadCount = 0;
            $scope.hasUnread = false;
            
            showToast('All notifications marked as read', 'success');
          } else {
            showToast('Error: ' + response.data.message, 'error');
          }
        })
        .catch(function(error) {
          console.error('Error marking all as read:', error);
          showToast('Server error. Please try again later.', 'error');
        });
    };
    
    // View the associated order
    $scope.viewOrder = function(orderId) {
      // Close the notification modal
      $scope.closeNotificationModal();
      
      // Redirect to order page with the specific order id
      $window.location.href = '/order?id=' + orderId;
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
    loadNotifications();
    
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
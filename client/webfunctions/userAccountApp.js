// accountApp.js - Angular controller for the user account page
angular.module('accountApp', [])
  .controller('AccountController', ['$scope', '$http', '$window', function($scope, $http, $window) {
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
    
    // Active tab (account tab is active by default)
    $scope.activeTab = 'account';
    
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
        case 'notifications':
          $window.location.href = '/public-messages';
          break;
        case 'mybook':
          $window.location.href = '/mybook';
          break;
        case 'account':
          // Already on the account page
          break;
        case 'dashboard':
          $window.location.href = '/dashboard';
          break;
        default:
          // Stay on account page for any unrecognized tab
          break;
      }
    };
    
    // Initialize profile data
    $scope.profile = {
      username: $scope.user.username,
      email: $scope.user.email,
      phone: '',
      address: ''
    };
    
    // Original profile for reverting changes
    $scope.originalProfile = { ...$scope.profile };
    
    // Edit mode flag
    $scope.editMode = false;
    
    // Function to enable edit mode
    $scope.enableEditMode = function() {
      $scope.editMode = true;
    };
    
    // Function to cancel edit
    $scope.cancelEdit = function() {
      $scope.profile = { ...$scope.originalProfile };
      $scope.editMode = false;
      $scope.usernameError = '';
      $scope.emailError = '';
    };
    
    // Load user profile data
    function loadUserProfile() {
      $http.get('/api/users/' + $scope.user.id + '/profile')
        .then(function(response) {
          if (response.data.success) {
            // Update profile with any additional data
            if (response.data.profile) {
              if (response.data.profile.phone) {
                $scope.profile.phone = response.data.profile.phone;
              }
              if (response.data.profile.address) {
                $scope.profile.address = response.data.profile.address;
              }
              
              // Update the original profile copy
              $scope.originalProfile = { ...$scope.profile };
            }
          } else {
            console.error('Error loading profile:', response.data.message);
          }
        })
        .catch(function(error) {
          console.error('Error loading profile:', error);
          // Silently fail - user can still edit their profile
        });
    }
    
    // Try to load profile data if it exists
    loadUserProfile();
    
    // Function to save profile changes
    $scope.saveProfile = function() {
      // Reset error messages
      $scope.usernameError = '';
      $scope.emailError = '';
      $scope.profileUpdateSuccess = '';
      
      // Validate username and email
      if (!$scope.profile.username) {
        $scope.usernameError = 'Username is required';
        return;
      }
      
      if (!$scope.profile.email) {
        $scope.emailError = 'Email is required';
        return;
      }
      
      // Check if email is valid
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test($scope.profile.email)) {
        $scope.emailError = 'Please enter a valid email address';
        return;
      }
      
      // Send update request to server
      $http.put('/api/users/' + $scope.user.id + '/profile', {
        username: $scope.profile.username,
        email: $scope.profile.email,
        phone: $scope.profile.phone || '',
        address: $scope.profile.address || ''
      })
        .then(function(response) {
          if (response.data.success) {
            // Update the original profile
            $scope.originalProfile = { ...$scope.profile };
            
            // Update the user data in localStorage
            $scope.user.username = $scope.profile.username;
            $scope.user.email = $scope.profile.email;
            $window.localStorage.setItem('user', JSON.stringify($scope.user));
            
            // Show success message
            $scope.profileUpdateSuccess = 'Profile updated successfully';
            
            // Exit edit mode
            $scope.editMode = false;
            
            // Show toast notification
            showToast('Profile updated successfully', 'success');
          } else {
            // Handle specific errors
            if (response.data.message.includes('username')) {
              $scope.usernameError = response.data.message;
            } else if (response.data.message.includes('email')) {
              $scope.emailError = response.data.message;
            } else {
              // Show generic error
              showToast('Error: ' + response.data.message, 'error');
            }
          }
        })
        .catch(function(error) {
          console.error('Error updating profile:', error);
          showToast('Server error. Please try again later.', 'error');
        });
    };
    
    // Password change modal management
    $scope.openPasswordModal = function() {
      document.getElementById('passwordModal').style.display = 'block';
    };
    
    $scope.closePasswordModal = function() {
      document.getElementById('passwordModal').style.display = 'none';
      // Reset password form
      $scope.passwordData = {
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      };
      $scope.currentPasswordError = '';
      $scope.passwordMismatch = false;
      $scope.passwordChangeError = '';
      $scope.passwordChangeSuccess = '';
    };


    // Close modal when clicking outside
    window.onclick = function(event) {
      var modal = document.getElementById('passwordModal');
      if (event.target == modal) {
        $scope.closePasswordModal();
        if (!$scope.$phase) {
          $scope.$apply();
        }
      }
    };

    // Prevent modal content clicks from closing the modal
    document.addEventListener('DOMContentLoaded', function() {
      var modalContent = document.querySelector('.modal-content');
      if (modalContent) {
        modalContent.addEventListener('click', function(event) {
          event.stopPropagation();
        });
      }
    });

    
    // Initialize password data
    $scope.passwordData = {
      currentPassword: '',
      newPassword: '',
      confirmPassword: ''
    };
    
    // Function to change password
    $scope.changePassword = function() {
      // Reset error messages
      $scope.currentPasswordError = '';
      $scope.passwordMismatch = false;
      $scope.passwordChangeError = '';
      $scope.passwordChangeSuccess = '';
      
      // Validate passwords
      if (!$scope.passwordData.currentPassword) {
        $scope.currentPasswordError = 'Current password is required';
        return;
      }
      
      if (!$scope.passwordData.newPassword) {
        $scope.passwordChangeError = 'New password is required';
        return;
      }
      
      if ($scope.passwordData.newPassword.length < 8) {
        $scope.passwordChangeError = 'Password must be at least 8 characters';
        return;
      }
      
      if ($scope.passwordData.newPassword !== $scope.passwordData.confirmPassword) {
        $scope.passwordMismatch = true;
        return;
      }
      
      // Send password change request to server
      $http.put('/api/users/' + $scope.user.id + '/change-password', {
        currentPassword: $scope.passwordData.currentPassword,
        newPassword: $scope.passwordData.newPassword
      })
        .then(function(response) {
          if (response.data.success) {
            // Show success message
            $scope.passwordChangeSuccess = 'Password changed successfully';
            
            // Show toast notification
            showToast('Password changed successfully', 'success');
            
            // Reset form after 2 seconds
            setTimeout(function() {
              $scope.closePasswordModal();
              $scope.$apply();
            }, 2000);
          } else {
            // Handle specific errors
            if (response.data.message.includes('current password')) {
              $scope.currentPasswordError = response.data.message;
            } else {
              // Show generic error
              $scope.passwordChangeError = response.data.message;
            }
          }
        })
        .catch(function(error) {
          console.error('Error changing password:', error);
          $scope.passwordChangeError = 'Server error. Please try again later.';
        });
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
        if (!$scope.$phase) {
          $scope.$apply();
        }
      }
    });
  }]);
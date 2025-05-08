// Angular.js application for the forgot password page
angular.module('forgotPasswordApp', [])
  .controller('ForgotPasswordController', ['$scope', '$http', '$window', function($scope, $http, $window) {
    // Initialize form data
    $scope.formData = {
      email: '',
      otp: '',
      newPassword: '',
      confirmPassword: ''
    };
    
    // Set initial step
    $scope.step = 1;
    
    // Message object for displaying alerts
    $scope.message = null;
    
    // Request password reset (Step 1)
    $scope.requestReset = function() {
      // Basic validation
      if (!$scope.formData.email) {
        $scope.message = {
          type: 'error',
          text: 'Please enter your email address'
        };
        return;
      }
      
      // Show loading message
      $scope.message = {
        type: 'info',
        text: 'Sending reset code...'
      };
      
      // Send request to server
      $http({
        method: 'POST',
        url: '/api/forgot-password',
        data: { email: $scope.formData.email }
      }).then(function(response) {
        // Success
        if (response.data.success) {
          $scope.message = {
            type: 'success',
            text: 'A reset code has been sent to your email. Please check your inbox.'
          };
          
          // Move to step 2
          $scope.step = 2;
        }
      }).catch(function(error) {
        // Error
        console.error('Password reset request error:', error);
        
        $scope.message = {
          type: 'error',
          text: error.data && error.data.message ? error.data.message : 'Failed to send reset code. Please try again.'
        };
      });
    };
    
    // Reset password (Step 2)
    $scope.resetPassword = function() {
      // Basic validation
      if (!$scope.formData.otp) {
        $scope.message = {
          type: 'error',
          text: 'Please enter the verification code'
        };
        return;
      }
      
      if (!$scope.formData.newPassword) {
        $scope.message = {
          type: 'error',
          text: 'Please enter a new password'
        };
        return;
      }
      
      if ($scope.formData.newPassword !== $scope.formData.confirmPassword) {
        $scope.message = {
          type: 'error',
          text: 'Passwords do not match'
        };
        return;
      }
      
      if ($scope.formData.newPassword.length < 6) {
        $scope.message = {
          type: 'error',
          text: 'Password must be at least 6 characters long'
        };
        return;
      }
      
      // Show loading message
      $scope.message = {
        type: 'info',
        text: 'Resetting password...'
      };
      
      // Send request to server
      $http({
        method: 'POST',
        url: '/api/reset-password',
        data: {
          email: $scope.formData.email,
          otp: $scope.formData.otp,
          newPassword: $scope.formData.newPassword
        }
      }).then(function(response) {
        // Success
        if (response.data.success) {
          $scope.message = {
            type: 'success',
            text: 'Password reset successfully. Redirecting to login page...'
          };
          
          // Redirect to login page after 2 seconds
          setTimeout(function() {
            $window.location.href = '/login';
          }, 2000);
        }
      }).catch(function(error) {
        // Error
        console.error('Password reset error:', error);
        
        $scope.message = {
          type: 'error',
          text: error.data && error.data.message ? error.data.message : 'Failed to reset password. Please try again.'
        };
      });
    };
    
  }]);
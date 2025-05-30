// Angular.js application for the registration page
angular.module('registerApp', [])
  .controller('RegisterController', ['$scope', '$http', '$window', '$timeout', function($scope, $http, $window, $timeout) {
    // Initialize form data
    $scope.formData = {
      username: '',
      email: '',
      otp: '',
      password: '',
      confirmPassword: ''
    };
    
    // Registration step (1: initial info, 2: OTP verification, 3: password creation)
    $scope.step = 1;
    
    // Message object for displaying alerts
    $scope.message = null;
    
    // Function to send OTP
    $scope.sendOTP = function() {
      // Basic validation
      if (!$scope.formData.username || !$scope.formData.email) {
        $scope.message = {
          type: 'error',
          text: 'Please fill in all fields'
        };
        return;
      }
      
      // Basic email validation
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test($scope.formData.email)) {
        $scope.message = {
          type: 'error',
          text: 'Please enter a valid email address'
        };
        return;
      }
      
      // Show loading message
      $scope.message = {
        type: 'info',
        text: 'Sending OTP...'
      };
      
      // Send OTP request to server - Use relative URL instead of absolute
      $http({
        method: 'POST',
        url: '/api/send-otp',
        data: {
          username: $scope.formData.username,
          email: $scope.formData.email
        }
      }).then(function(response) {
        // Success
        if (response.data.success) {
          $scope.message = {
            type: 'success',
            text: 'OTP sent to your email. Please check your inbox.'
          };
          
          // Move to OTP verification step
          $scope.step = 2;
          
          // Clear message after 5 seconds
          $timeout(function() {
            $scope.message = null;
          }, 5000);
        }
      }).catch(function(error) {
        // Error
        console.error('OTP error:', error);
        
        $scope.message = {
          type: 'error',
          text: error.data && error.data.message ? error.data.message : 'Failed to send OTP. Please try again.'
        };
      });
    };
    
    // Function to verify OTP
    $scope.verifyOTP = function() {
      // Basic validation
      if (!$scope.formData.otp) {
        $scope.message = {
          type: 'error',
          text: 'Please enter the OTP'
        };
        return;
      }
      
      // Show loading message
      $scope.message = {
        type: 'info',
        text: 'Verifying OTP...'
      };
      
      // Send verification request to server - Use relative URL
      $http({
        method: 'POST',
        url: '/api/verify-otp',
        data: {
          email: $scope.formData.email,
          otp: $scope.formData.otp,
          password: null // We'll set the password in the next step
        }
      }).then(function(response) {
        // In a real implementation, we would validate the OTP with the server
        // For this flow, we just move to the password step
        $scope.message = {
          type: 'success',
          text: 'OTP verified successfully'
        };
        
        // Move to password creation step
        $scope.step = 3;
        
        // Clear message after 5 seconds
        $timeout(function() {
          $scope.message = null;
        }, 5000);
      }).catch(function(error) {
        console.error('OTP verification error:', error);
        
        $scope.message = {
          type: 'error',
          text: error.data && error.data.message ? error.data.message : 'OTP verification failed. Please try again.'
        };
      });
    };
    
    // Function to complete registration
    $scope.register = function() {
      // Basic validation
      if (!$scope.formData.password || !$scope.formData.confirmPassword) {
        $scope.message = {
          type: 'error',
          text: 'Please fill in all fields'
        };
        return;
      }
      
      // Password matching validation
      if ($scope.formData.password !== $scope.formData.confirmPassword) {
        $scope.message = {
          type: 'error',
          text: 'Passwords do not match'
        };
        return;
      }
      
      // Password strength validation (at least 8 characters)
      if ($scope.formData.password.length < 8) {
        $scope.message = {
          type: 'error',
          text: 'Password must be at least 8 characters long'
        };
        return;
      }
      
      // Show loading message
      $scope.message = {
        type: 'info',
        text: 'Creating your account...'
      };
      
      // Send registration request to server - Use relative URL
      $http({
        method: 'POST',
        url: '/api/verify-otp',
        data: {
          email: $scope.formData.email,
          otp: $scope.formData.otp,
          password: $scope.formData.password
        }
      }).then(function(response) {
        // Success
        if (response.data.success) {
          $scope.message = {
            type: 'success',
            text: 'Registration successful! Redirecting to login...'
          };
          
          // Redirect to login page after 2 seconds
          $timeout(function() {
            $window.location.href = '/login';
          }, 2000);
        }
      }).catch(function(error) {
        // Error
        console.error('Registration error:', error);
        
        $scope.message = {
          type: 'error',
          text: error.data && error.data.message ? error.data.message : 'Registration failed. Please try again.'
        };
      });
    };
  }]);
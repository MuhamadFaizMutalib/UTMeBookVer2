// Angular.js application for the login page
angular.module('loginApp', [])
  .controller('LoginController', ['$scope', '$http', '$window', function($scope, $http, $window) {
    // Initialize form data
    $scope.formData = {
      username: '',
      password: ''
    };
    
    // Message object for displaying alerts
    $scope.message = null;
    
    // Login function
    $scope.login = function() {
      // Basic validation
      if (!$scope.formData.username || !$scope.formData.password) {
        $scope.message = {
          type: 'error',
          text: 'Please fill in all fields'
        };
        return;
      }
      
      // Show loading message
      $scope.message = {
        type: 'info',
        text: 'Logging in...'
      };
      
      // Send login request to server - Use relative URL instead of absolute
      $http({
        method: 'POST',
        url: '/api/login',
        data: $scope.formData
      }).then(function(response) {
        // Success
        if (response.data.success) {
          // Store user data in localStorage (in a real app, use JWT)
          $window.localStorage.setItem('user', JSON.stringify(response.data.user));
          
          // Redirect to dashboard
          $window.location.href = '/dashboard';
        }
      }).catch(function(error) {
        // Error
        console.error('Login error:', error);
        
        $scope.message = {
          type: 'error',
          text: error.data && error.data.message ? error.data.message : 'Login failed. Please check your credentials.'
        };
      });
    };
  }]);
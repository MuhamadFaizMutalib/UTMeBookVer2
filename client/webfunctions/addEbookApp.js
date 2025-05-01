// Angular.js application for the add-ebook page
angular.module('addEbookApp', [])
  .controller('AddEbookController', ['$scope', '$http', '$window', function($scope, $http, $window) {
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
    
    // Toggle mobile menu
    $scope.toggleMobileMenu = function() {
      $scope.mobileMenuOpen = !$scope.mobileMenuOpen;
    };
    
    // Initialize book object
    $scope.book = {
      title: '',
      category: '',
      price: '',
      description: '',
      status: 'Available'
    };
    
    // For file preview
    $scope.coverPreview = null;
    $scope.bookFileName = null;
    
    // Navigation function
    $scope.navigateTo = function(page) {
      if (page === 'dashboard') {
        $window.location.href = '/dashboard';
      } else {
        // For simplicity, we'll just redirect to the same page with different active tabs
        // In a real app, this would navigate to different pages or update the UI
        $window.location.href = '/dashboard?tab=' + page;
      }
    };
    
    // File upload directive for handling file input
    angular.module('addEbookApp').directive('fileModel', ['$parse', function($parse) {
      return {
        restrict: 'A',
        link: function(scope, element, attrs) {
          var model = $parse(attrs.fileModel);
          var modelSetter = model.assign;
          
          element.bind('change', function() {
            scope.$apply(function() {
              modelSetter(scope, element[0].files[0]);
              
              // Add preview for cover image
              if (attrs.id === 'coverImage' && element[0].files[0]) {
                var reader = new FileReader();
                reader.onload = function(e) {
                  scope.$apply(function() {
                    scope.coverPreview = e.target.result;
                  });
                };
                reader.readAsDataURL(element[0].files[0]);
              }
              
              // Display file name for book file
              if (attrs.id === 'bookFile' && element[0].files[0]) {
                scope.$apply(function() {
                  scope.bookFileName = element[0].files[0].name;
                });
              }
            });
          });
        }
      };
    }]);
    
    // Submit book function
    $scope.submitBook = function() {
      // Validate inputs
      if (!$scope.book.title || !$scope.book.category || !$scope.book.price || !$scope.book.description) {
        $scope.errorMessage = 'Please fill in all required fields';
        return;
      }
      
      if (!$scope.book.coverImage) {
        $scope.errorMessage = 'Please upload a cover image';
        return;
      }
      
      if (!$scope.book.bookFile) {
        $scope.errorMessage = 'Please upload a book file (PDF)';
        return;
      }
      
      // Clear previous messages
      $scope.errorMessage = null;
      $scope.successMessage = null;
      
      // Create FormData object to send files
      var formData = new FormData();
      formData.append('title', $scope.book.title);
      formData.append('category', $scope.book.category);
      formData.append('price', $scope.book.price);
      formData.append('description', $scope.book.description);
      formData.append('status', $scope.book.status);
      formData.append('sellerId', $scope.user.id);
      formData.append('coverImage', $scope.book.coverImage);
      formData.append('bookFile', $scope.book.bookFile);
      
      // Send the form data to the server
      $http.post('/api/books/add', formData, {
        transformRequest: angular.identity,
        headers: {'Content-Type': undefined}
      }).then(function(response) {
        if (response.data.success) {
          $scope.successMessage = 'Book added successfully!';
          
          // Reset form
          $scope.book = {
            title: '',
            category: '',
            price: '',
            description: '',
            status: 'Available'
          };
          $scope.coverPreview = null;
          $scope.bookFileName = null;
          
          // Reset file inputs (hacky way, but Angular doesn't provide a clean way)
          document.getElementById('coverImage').value = '';
          document.getElementById('bookFile').value = '';
          
          // Redirect to dashboard after a short delay
          setTimeout(function() {
            $window.location.href = '/dashboard';
          }, 2000);
        } else {
          $scope.errorMessage = response.data.message || 'Error adding book';
        }
      }).catch(function(error) {
        console.error('Error adding book:', error);
        $scope.errorMessage = 'Server error. Please try again later.';
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
  }]);
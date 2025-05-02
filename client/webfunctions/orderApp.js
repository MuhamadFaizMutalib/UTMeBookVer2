// Angular.js application for the order page
angular.module('orderApp', [])
  .controller('OrderController', ['$scope', '$http', '$window', function($scope, $http, $window) {
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
    $scope.showEditModal = false;
    $scope.editedBook = {};
    $scope.editCoverPreview = null;
    $scope.editBookFileName = null;
    $scope.successMessage = null;
    $scope.errorMessage = null;
    
    // Toggle mobile menu
    $scope.toggleMobileMenu = function() {
      $scope.mobileMenuOpen = !$scope.mobileMenuOpen;
    };
    
    // Initialize arrays for the order page
    $scope.mySales = [];

    
        // Function to set active tab and handle navigation
        $scope.setActiveTab = function(tab) {
          // If on mobile, close the menu after selecting an item
          if (window.innerWidth <= 768) {
            $scope.mobileMenuOpen = false;
          }
          
          // Navigate to the appropriate page based on the tab
          switch(tab) {

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
    
    // Load user's sales
    function loadMySales() {
      $http.get('/api/books/my-sales/' + $scope.user.id)
        .then(function(response) {
          if (response.data.success) {
            $scope.mySales = response.data.books;
          } else {
            console.error('Error loading my sales:', response.data.message);
            showToast('Error loading your books', 'error');
          }
        })
        .catch(function(error) {
          console.error('Error loading my sales:', error);
          showToast('Server error. Please try again later.', 'error');
        });
    }
       
    // Load data on page load
    loadMySales();

    // Function to open edit modal
    $scope.editBook = function(book) {
      $scope.successMessage = null;
      $scope.errorMessage = null;
      $scope.editCoverPreview = null;
      $scope.editBookFileName = null;
      
      // Clone the book object to avoid modifying the original
      $scope.editedBook = {
        id: book.id,
        title: book.title,
        category: book.category,
        price: book.price,
        description: book.description || '',
        status: book.status,
        coverUrl: book.coverUrl
      };
      
      $scope.showEditModal = true;
    };
    
    // Close edit modal
    $scope.closeEditModal = function() {
      $scope.showEditModal = false;
    };
    
    // Handle file uploads for edit form
    $scope.setEditFile = function(element) {
      if (element.id === 'edit-coverImage') {
        $scope.$apply(function() {
          $scope.editedBook.newCoverImage = element.files[0];
          
          // Create preview
          if (element.files[0]) {
            const reader = new FileReader();
            reader.onload = function(e) {
              $scope.$apply(function() {
                $scope.editCoverPreview = e.target.result;
              });
            };
            reader.readAsDataURL(element.files[0]);
          }
        });
      } else if (element.id === 'edit-bookFile') {
        $scope.$apply(function() {
          $scope.editedBook.newBookFile = element.files[0];
          
          // Show filename
          if (element.files[0]) {
            $scope.editBookFileName = element.files[0].name;
          }
        });
      }
    };
    
    // Update book function
    $scope.updateBook = function() {
      // Validate inputs
      if (!$scope.editedBook.title || !$scope.editedBook.category || !$scope.editedBook.price || !$scope.editedBook.description) {
        $scope.errorMessage = 'Please fill in all required fields';
        return;
      }
      
      // Clear previous messages
      $scope.errorMessage = null;
      $scope.successMessage = null;
      
      // Create FormData object to send files
      var formData = new FormData();
      formData.append('title', $scope.editedBook.title);
      formData.append('category', $scope.editedBook.category);
      formData.append('price', $scope.editedBook.price);
      formData.append('description', $scope.editedBook.description);
      formData.append('status', $scope.editedBook.status);
      formData.append('sellerId', $scope.user.id);
      
      // Add files only if provided
      if ($scope.editedBook.newCoverImage) {
        formData.append('coverImage', $scope.editedBook.newCoverImage);
      }
      
      if ($scope.editedBook.newBookFile) {
        formData.append('bookFile', $scope.editedBook.newBookFile);
      }
      
      // Send the form data to the server
      $http.put('/api/books/' + $scope.editedBook.id, formData, {
        transformRequest: angular.identity,
        headers: {'Content-Type': undefined}
      }).then(function(response) {
        if (response.data.success) {
          $scope.successMessage = 'Book updated successfully!';
          
          // Update the book in the list
          for (var i = 0; i < $scope.mySales.length; i++) {
            if ($scope.mySales[i].id === $scope.editedBook.id) {
              $scope.mySales[i].title = $scope.editedBook.title;
              $scope.mySales[i].category = $scope.editedBook.category;
              $scope.mySales[i].price = parseFloat($scope.editedBook.price);
              $scope.mySales[i].description = $scope.editedBook.description;
              $scope.mySales[i].status = $scope.editedBook.status;
              
              // Update cover URL if a new cover was uploaded
              if ($scope.editCoverPreview) {
                // The actual URL will be replaced after reloading
                // This is just a temporary update for UI
              }
              
              break;
            }
          }
          
          // Close modal and reload data after a short delay
          setTimeout(function() {
            $scope.showEditModal = false;
            loadMySales(); // Reload to get updated data from server
            $scope.$apply();
          }, 1500);
          
        } else {
          $scope.errorMessage = response.data.message || 'Error updating book';
        }
      }).catch(function(error) {
        console.error('Error updating book:', error);
        $scope.errorMessage = 'Server error. Please try again later.';
      });
    };
    
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
  }]);
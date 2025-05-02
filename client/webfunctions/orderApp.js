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
    
    // Toggle mobile menu
    $scope.toggleMobileMenu = function() {
      $scope.mobileMenuOpen = !$scope.mobileMenuOpen;
    };
    
    // Initialize arrays for the order page
    $scope.mySales = [];
    $scope.myPurchases = [];
    
    // Edit book modal state
    $scope.editModalVisible = false;
    $scope.editingBook = null;
    $scope.coverPreview = null;
    $scope.bookFileName = null;
    $scope.errorMessage = null;
    $scope.successMessage = null;
    
    // Navigation function
    $scope.navigateTo = function(page) {
      switch(page) {
        case 'dashboard':
          $window.location.href = '/dashboard';
          break;
        case 'add-ebook':
          $window.location.href = '/add-ebook';
          break;
        case 'order':
          // Already on order page
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
          $window.location.href = '/dashboard';
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
    
    // Load user's purchases
    function loadMyPurchases() {
      $http.get('/api/books/my-purchases/' + $scope.user.id)
        .then(function(response) {
          if (response.data.success) {
            $scope.myPurchases = response.data.purchases;
          } else {
            console.error('Error loading my purchases:', response.data.message);
            showToast('Error loading your purchases', 'error');
          }
        })
        .catch(function(error) {
          console.error('Error loading my purchases:', error);
          showToast('Server error. Please try again later.', 'error');
        });
    }
    
    // Load data on page load
    loadMySales();
    loadMyPurchases();
    
    // Function to open edit modal
    $scope.editBook = function(book) {
      $scope.editingBook = {
        id: book.id,
        title: book.title,
        category: book.category,
        price: book.price,
        description: book.description || '',
        status: book.status
      };
      
      // Set preview for existing cover image
      $scope.coverPreview = book.coverUrl;
      $scope.bookFileName = null;
      
      // Clear previous messages
      $scope.errorMessage = null;
      $scope.successMessage = null;
      
      // Show modal
      $scope.editModalVisible = true;
      
      // Prevent scrolling on the body when modal is open
      document.body.style.overflow = 'hidden';
    };
    
    // Function to close edit modal
    $scope.closeEditModal = function() {
      $scope.editModalVisible = false;
      $scope.editingBook = null;
      $scope.coverPreview = null;
      $scope.bookFileName = null;
      $scope.errorMessage = null;
      $scope.successMessage = null;
      
      // Restore body scrolling
      document.body.style.overflow = '';
    };
    
    // Function to handle file selection for cover image
    $scope.setCoverImage = function(element) {
      if (element.files[0]) {
        $scope.$apply(function() {
          const reader = new FileReader();
          reader.onload = function(e) {
            $scope.$apply(function() {
              $scope.coverPreview = e.target.result;
            });
          };
          reader.readAsDataURL(element.files[0]);
        });
      }
    };
    
    // Function to handle file selection for book file
    $scope.setBookFile = function(element) {
      if (element.files[0]) {
        $scope.$apply(function() {
          $scope.bookFileName = element.files[0].name;
        });
      }
    };
    
    // Function to update book
    $scope.updateBook = function() {
      // Validate inputs
      if (!$scope.editingBook.title || !$scope.editingBook.category || !$scope.editingBook.price || !$scope.editingBook.description) {
        $scope.errorMessage = 'Please fill in all required fields';
        return;
      }
      
      // Clear previous messages
      $scope.errorMessage = null;
      $scope.successMessage = null;
      
      // Create FormData object to send files
      var formData = new FormData();
      formData.append('title', $scope.editingBook.title);
      formData.append('category', $scope.editingBook.category);
      formData.append('price', $scope.editingBook.price);
      formData.append('description', $scope.editingBook.description);
      formData.append('status', $scope.editingBook.status);
      formData.append('sellerId', $scope.user.id);
      
      // Add cover image if a new one was selected
      var coverImageInput = document.getElementById('editCoverImage');
      if (coverImageInput && coverImageInput.files && coverImageInput.files.length > 0) {
        formData.append('coverImage', coverImageInput.files[0]);
      }
      
      // Add book file if a new one was selected
      var bookFileInput = document.getElementById('editBookFile');
      if (bookFileInput && bookFileInput.files && bookFileInput.files.length > 0) {
        formData.append('bookFile', bookFileInput.files[0]);
      }
      
      // Show loading indicator or message
      $scope.isUpdating = true;
      
      // Send the form data to the server
      $http.put('/api/books/' + $scope.editingBook.id, formData, {
        transformRequest: angular.identity,
        headers: {'Content-Type': undefined}
      }).then(function(response) {
        $scope.isUpdating = false;
        
        if (response.data.success) {
          $scope.successMessage = 'Book updated successfully!';
          
          // Reload sales list after a short delay
          setTimeout(function() {
            loadMySales();
            $scope.closeEditModal();
            showToast('Book updated successfully', 'success');
          }, 1500);
        } else {
          $scope.errorMessage = response.data.message || 'Error updating book';
        }
      }).catch(function(error) {
        $scope.isUpdating = false;
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
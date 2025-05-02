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
    
    // Edit modal state
    $scope.showEditModal = false;
    $scope.editBookData = {};
    
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
      // Clone the book object to avoid direct binding
      $scope.editBookData = {
        id: book.id,
        title: book.title,
        category: book.category,
        price: book.price,
        description: book.description || '',
        status: book.status,
        coverUrl: book.coverUrl
      };
      
      // Show the modal
      $scope.showEditModal = true;
    };
    
    // Function to close edit modal
    $scope.closeEditModal = function() {
      $scope.showEditModal = false;
      $scope.editBookData = {};
      
      // Reset file inputs
      document.getElementById('editBookForm').reset();
    };
    
    // Function to update book
    $scope.updateBook = function() {
      // Create FormData object for file uploads
      const formData = new FormData();
      
      // Add book data to FormData
      formData.append('title', $scope.editBookData.title);
      formData.append('category', $scope.editBookData.category);
      formData.append('price', $scope.editBookData.price);
      formData.append('description', $scope.editBookData.description);
      formData.append('status', $scope.editBookData.status);
      formData.append('sellerId', $scope.user.id);
      
      // Add files if selected
      const coverImageInput = document.getElementById('editCoverImage');
      const bookFileInput = document.getElementById('editBookFile');
      
      if (coverImageInput.files.length > 0) {
        formData.append('coverImage', coverImageInput.files[0]);
      }
      
      if (bookFileInput.files.length > 0) {
        formData.append('bookFile', bookFileInput.files[0]);
      }
      
      // Make PUT request to update book
      $http.put('/api/books/' + $scope.editBookData.id, formData, {
        headers: {
          'Content-Type': undefined // Let the browser set the content type for FormData
        },
        transformRequest: angular.identity
      })
        .then(function(response) {
          if (response.data.success) {
            // Update book in the sales list
            const index = $scope.mySales.findIndex(book => book.id === $scope.editBookData.id);
            if (index !== -1) {
              // Update fields in the original book object
              $scope.mySales[index].title = $scope.editBookData.title;
              $scope.mySales[index].category = $scope.editBookData.category;
              $scope.mySales[index].price = $scope.editBookData.price;
              
              // If a new cover image was uploaded, update the cover URL
              if (coverImageInput.files.length > 0) {
                // The server returns the book ID, but not the new cover URL
                // We'll reload the books to get the updated URL
                loadMySales();
              }
            }
            
            // Close the modal
            $scope.closeEditModal();
            
            // Show success message
            showToast('Book updated successfully', 'success');
          } else {
            showToast('Error: ' + response.data.message, 'error');
          }
        })
        .catch(function(error) {
          console.error('Error updating book:', error);
          showToast('Server error. Please try again later.', 'error');
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
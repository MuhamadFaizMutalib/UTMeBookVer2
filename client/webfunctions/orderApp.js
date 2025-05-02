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
    

    // Initialize variables for edit modal
    $scope.showEditModal = false;
    $scope.editingBook = null;
    $scope.editCoverPreview = null;
    $scope.editBookFileName = null;

    // Function to open edit modal
    $scope.editBook = function(book) {
      // Clone the book object to avoid modifying the original directly
      $scope.editingBook = {
        id: book.id,
        title: book.title,
        category: book.category,
        price: book.price,
        description: book.description || '',
        status: book.status,
        coverUrl: book.coverUrl
      };
      
      // Reset file inputs
      $scope.editCoverPreview = null;
      $scope.editBookFileName = null;
      
      // Show the modal
      $scope.showEditModal = true;
    };

    // Function to close edit modal
    $scope.closeEditModal = function() {
      $scope.showEditModal = false;
      $scope.editingBook = null;
      
      // Reset file inputs
      document.getElementById('editCoverImage').value = '';
      document.getElementById('editBookFile').value = '';
    };

    // File handler for edit form
    $scope.setEditFile = function(element) {
      if (element.id === 'editCoverImage') {
        $scope.$apply(function() {
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
      } else if (element.id === 'editBookFile') {
        $scope.$apply(function() {
          // Show filename
          if (element.files[0]) {
            $scope.editBookFileName = element.files[0].name;
          }
        });
      }
    };

    // Function to update book
    $scope.updateBook = function() {
      // Validate inputs
      if (!$scope.editingBook.title || !$scope.editingBook.category || 
          !$scope.editingBook.price || !$scope.editingBook.description) {
        showToast('Please fill in all required fields', 'error');
        return;
      }
      
      // Get files directly from DOM
      var coverImageInput = document.getElementById('editCoverImage');
      var bookFileInput = document.getElementById('editBookFile');
      
      var coverFile = coverImageInput.files[0];
      var bookFile = bookFileInput.files[0];
      
      // Create FormData object to send files
      var formData = new FormData();
      formData.append('title', $scope.editingBook.title);
      formData.append('category', $scope.editingBook.category);
      formData.append('price', $scope.editingBook.price);
      formData.append('description', $scope.editingBook.description);
      formData.append('status', $scope.editingBook.status);
      formData.append('sellerId', $scope.user.id);
      
      // Only append files if they are selected
      if (coverFile) {
        formData.append('coverImage', coverFile);
      }
      
      if (bookFile) {
        formData.append('bookFile', bookFile);
      }
      
      // Send the form data to the server
      $http.put('/api/books/' + $scope.editingBook.id, formData, {
        transformRequest: angular.identity,
        headers: {'Content-Type': undefined}
      }).then(function(response) {
        if (response.data.success) {
          // Close modal
          $scope.closeEditModal();
          
          // Update the book in the list
          for (var i = 0; i < $scope.mySales.length; i++) {
            if ($scope.mySales[i].id === $scope.editingBook.id) {
              // Update the book properties
              $scope.mySales[i].title = $scope.editingBook.title;
              $scope.mySales[i].category = $scope.editingBook.category;
              $scope.mySales[i].price = parseFloat($scope.editingBook.price);
              $scope.mySales[i].description = $scope.editingBook.description;
              $scope.mySales[i].status = $scope.editingBook.status;
              
              // Refresh the cover URL to see the updated image (add timestamp to prevent caching)
              if (coverFile) {
                $scope.mySales[i].coverUrl = $scope.mySales[i].coverUrl + '?t=' + new Date().getTime();
              }
              break;
            }
          }
          
          showToast('Book updated successfully', 'success');
        } else {
          showToast(response.data.message || 'Error updating book', 'error');
        }
      }).catch(function(error) {
        console.error('Error updating book:', error);
        showToast('Server error. Please try again later.', 'error');
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
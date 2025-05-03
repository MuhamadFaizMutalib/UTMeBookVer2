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
    $scope.purchasesCollapsed = false;
    $scope.salesCollapsed = false;

    // Toggle functions
    $scope.togglePurchases = function() {
      $scope.purchasesCollapsed = !$scope.purchasesCollapsed;
    };

    $scope.toggleSales = function() {
      $scope.salesCollapsed = !$scope.salesCollapsed;
    };

    // Toggle mobile menu
    $scope.toggleMobileMenu = function() {
      $scope.mobileMenuOpen = !$scope.mobileMenuOpen;
    };
    
    // Initialize arrays for the order page
    $scope.mySales = [];
    $scope.myPurchases = [];

    
        // Function to set active tab and handle navigation
        $scope.setActiveTab = function(tab) {
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


    // Load user's purchases
    function loadMyPurchases() {
      $http.get('/api/purchases/my-purchases/' + $scope.user.id)
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

    // Call loadMyPurchases after loadMySales
    // Load data on page load
    loadMySales();
    loadMyPurchases();

    // Add functions for purchase management
    // Function to cancel an order
    $scope.cancelOrder = function(purchase) {
      if (confirm('Are you sure you want to cancel this order? This action cannot be undone.')) {
        $http.put('/api/purchases/cancel/' + purchase.orderId, { userId: $scope.user.id })
          .then(function(response) {
            if (response.data.success) {
              // Update the purchase in the list
              for (var i = 0; i < $scope.myPurchases.length; i++) {
                if ($scope.myPurchases[i].orderId === purchase.orderId) {
                  $scope.myPurchases[i].status = 'Canceled';
                  break;
                }
              }
              
              showToast('Order canceled successfully', 'success');
            } else {
              showToast('Error: ' + response.data.message, 'error');
            }
          })
          .catch(function(error) {
            console.error('Error canceling order:', error);
            showToast('Server error. Please try again later.', 'error');
          });
      }
    };

    // Function to open edit MAC address modal
    $scope.editMAC = function(purchase) {
      $scope.successMessage = null;
      $scope.errorMessage = null;
      
      $scope.editedPurchase = {
        orderId: purchase.orderId,
        title: purchase.title,
        macAddress: purchase.macAddress
      };
      
      $scope.showEditMACModal = true;
    };

    // Close edit MAC modal
    $scope.closeEditMACModal = function() {
      $scope.showEditMACModal = false;
    };

    // Update MAC address function
    $scope.updateMAC = function() {
      // Validate MAC address format
      const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
      if (!macRegex.test($scope.editedPurchase.macAddress)) {
        $scope.errorMessage = 'Please enter a valid MAC address format (XX:XX:XX:XX:XX:XX)';
        return;
      }
      
      // Clear previous messages
      $scope.errorMessage = null;
      $scope.successMessage = null;
      
      // Send update to server
      $http.put('/api/purchases/update-mac/' + $scope.editedPurchase.orderId, {
        userId: $scope.user.id,
        macAddress: $scope.editedPurchase.macAddress
      }).then(function(response) {
        if (response.data.success) {
          $scope.successMessage = 'MAC address updated successfully!';
          
          // Update the purchase in the list
          for (var i = 0; i < $scope.myPurchases.length; i++) {
            if ($scope.myPurchases[i].orderId === $scope.editedPurchase.orderId) {
              $scope.myPurchases[i].macAddress = $scope.editedPurchase.macAddress;
              break;
            }
          }
          
          // Close modal after a short delay
          setTimeout(function() {
            $scope.showEditMACModal = false;
            $scope.$apply();
          }, 1500);
          
        } else {
          $scope.errorMessage = response.data.message || 'Error updating MAC address';
        }
      }).catch(function(error) {
        console.error('Error updating MAC address:', error);
        $scope.errorMessage = 'Server error. Please try again later.';
      });
    };




  }]);
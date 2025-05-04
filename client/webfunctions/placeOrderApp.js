angular.module('placeOrderApp', [])
  .controller('PlaceOrderController', ['$scope', '$http', '$window', '$location', function($scope, $http, $window, $location) {
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
    
    // Get book ID from URL
    const urlParams = new URLSearchParams(window.location.search);
    const bookId = urlParams.get('bookId');
    
    if (!bookId) {
      console.error('No book ID provided');
      $window.location.href = '/dashboard';
      return;
    }
    
    // Initialize book data
    $scope.book = {};
    
    // Mobile menu state
    $scope.mobileMenuOpen = false;
    
    // Add Stripe payment link
    $scope.stripePaymentLink = 'https://buy.stripe.com/test_cN2bIIcjL8Cc1mofYZ';
    
    // Toggle mobile menu
    $scope.toggleMobileMenu = function() {
      $scope.mobileMenuOpen = !$scope.mobileMenuOpen;
    };
    
    // Initialize MAC address
    $scope.macAddress = '';
    
    // Initialize modal state
    $scope.showInstructionModal = false;
    $scope.instructionType = '';
    
    // Payment method selection
    $scope.paymentMethod = 'bypass'; // Default to bypass
    
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

    // Function to load book details
    function loadBookDetails() {
      $http.get('/api/books/' + bookId)
        .then(function(response) {
          if (response.data.success) {
            $scope.book = response.data.book;
          } else {
            console.error('Error loading book details:', response.data.message);
            showToast('Error loading book details', 'error');
          }
        })
        .catch(function(error) {
          console.error('Error loading book details:', error);
          showToast('Error loading book details', 'error');
        });
    }

    // Function to show instructions modal
    $scope.showInstructions = function(type) {
      $scope.instructionType = type;
      $scope.showInstructionModal = true;
    };
    
    // Function to close instructions modal
    $scope.closeInstructions = function() {
      $scope.showInstructionModal = false;
    };
    
    // Function to handle place order action with Stripe payment
    $scope.goToStripePayment = function() {
      // Validate MAC address
      if (!$scope.macAddress) {
        showToast('Please enter your MAC address', 'error');
        return;
      }
      
      // Validate MAC address format (XX:XX:XX:XX:XX:XX)
      const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
      if (!macRegex.test($scope.macAddress)) {
        showToast('Please enter a valid MAC address format (XX:XX:XX:XX:XX:XX)', 'error');
        return;
      }

      // Store MAC address in localStorage for retrieval after payment
      localStorage.setItem('pendingOrderMacAddress', $scope.macAddress);
      localStorage.setItem('pendingOrderBookId', bookId);
      
      // Redirect to Stripe payment link
      window.location.href = $scope.stripePaymentLink;
    };
    
    // Function to place order without payment (bypass)
    $scope.placeOrder = function() {
      // Validate MAC address
      if (!$scope.macAddress) {
        showToast('Please enter your MAC address', 'error');
        return;
      }
      
      // Validate MAC address format (XX:XX:XX:XX:XX:XX)
      const macRegex = /^([0-9A-Fa-f]{2}[:-]){5}([0-9A-Fa-f]{2})$/;
      if (!macRegex.test($scope.macAddress)) {
        showToast('Please enter a valid MAC address format (XX:XX:XX:XX:XX:XX)', 'error');
        return;
      }
      
      // Skip Stripe completely and place order
      placeOrderWithoutPayment();
    };

    // Function to place order without payment (bypass)
    function placeOrderWithoutPayment() {
      const orderData = {
        bookId: parseInt(bookId),
        buyerId: $scope.user.id,
        paymentMethod: 'bypass',
        macAddress: $scope.macAddress,
        paymentIntentId: null
      };
      
      $http.post('/api/purchases/place-order', orderData)
        .then(function(response) {
          if (response && response.data.success) {
            showToast('Order placed successfully (Payment Bypassed)! Order ID: ' + response.data.orderId, 'success');
            setTimeout(function() {
              $window.location.href = '/order';
            }, 3000);
          } else if (response) {
            showToast('Error: ' + response.data.message, 'error');
          }
        })
        .catch(function(error) {
          console.error('Error placing order:', error);
          showToast('Failed to place order. Please try again.', 'error');
        });
    }

    // Check if returning from Stripe payment
    function checkReturnFromStripe() {
      const returnStatus = urlParams.get('stripe_status');
      
      if (returnStatus === 'success') {
        // Get the previously stored MAC address and book ID
        const macAddress = localStorage.getItem('pendingOrderMacAddress');
        const storedBookId = localStorage.getItem('pendingOrderBookId');
        
        if (macAddress && storedBookId && storedBookId === bookId) {
          // Clear stored data
          localStorage.removeItem('pendingOrderMacAddress');
          localStorage.removeItem('pendingOrderBookId');
          
          // Place the order with 'stripe' as payment method
          const orderData = {
            bookId: parseInt(bookId),
            buyerId: $scope.user.id,
            paymentMethod: 'stripe',
            macAddress: macAddress,
            paymentIntentId: urlParams.get('payment_intent') || 'stripe_hosted_checkout'
          };
          
          $http.post('/api/purchases/place-order', orderData)
            .then(function(response) {
              if (response && response.data.success) {
                showToast('Payment successful! Order placed. Order ID: ' + response.data.orderId, 'success');
                setTimeout(function() {
                  $window.location.href = '/order';
                }, 3000);
              } else if (response) {
                showToast('Error: ' + response.data.message, 'error');
              }
            })
            .catch(function(error) {
              console.error('Error placing order:', error);
              showToast('Failed to place order. Please try again.', 'error');
            });
        }
      } else if (returnStatus === 'cancel') {
        showToast('Payment was canceled. You can try again or use the bypass option.', 'info');
      }
    }
    
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
    
    // Logout function
    $scope.logout = function() {
      if (confirm('Are you sure you want to logout?')) {
        // Clear user data from localStorage
        $window.localStorage.removeItem('user');
        
        // Redirect to login page
        $window.location.href = '/login';
      }
    };
    
    // Load book details on page load
    loadBookDetails();
    
    // Check if returning from Stripe payment
    checkReturnFromStripe();
  }]);
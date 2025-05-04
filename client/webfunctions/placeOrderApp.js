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
    
    // Toggle mobile menu
    $scope.toggleMobileMenu = function() {
      $scope.mobileMenuOpen = !$scope.mobileMenuOpen;
    };
    
    // Initialize Stripe elements
    let stripe = null;
    let elements = null;
    let paymentElement = null;
    
    // Function to initialize Stripe
    function initStripe() {
      // Initialize Stripe with your publishable key from environment
      // The publishable key is safe to include in client-side code
      stripe = Stripe(stripePublishableKey); // This will be defined elsewhere
      
      // Create payment element options
      const options = {
        mode: 'payment',
        amount: Math.round($scope.book.price * 100), // Convert to cents
        currency: 'myr',
        appearance: {
          theme: 'stripe',
          variables: {
            colorPrimary: '#0066cc',
          },
        },
      };
      
      // Create elements instance
      elements = stripe.elements(options);
      
      // Create and mount the Payment Element
      paymentElement = elements.create('payment');
      paymentElement.mount('#stripe-payment-element');
      
      // Handle real-time validation errors
      paymentElement.on('change', function(event) {
        const displayError = document.querySelector('.card-errors');
        if (event.error) {
          displayError.textContent = event.error.message;
        } else {
          displayError.textContent = '';
        }
      });
    }
    
    // Initialize MAC address
    $scope.macAddress = '';
    
    // Initialize modal state
    $scope.showInstructionModal = false;
    $scope.instructionType = '';
    
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


  
    function loadBookDetails() {
      $http.get('/api/books/' + bookId)
        .then(function(response) {
          if (response.data.success) {
            $scope.book = response.data.book;
            return $http.get('/api/stripe-config');
          } else {
            console.error('Error loading book details:', response.data.message);
            showToast('Error loading book details', 'error');
            throw new Error('Failed to load book details');
          }
        })
        .then(function(response) {
          if (response && response.data && response.data.publishableKey) {
            try {
              // Initialize Stripe with the publishable key from the server
              stripe = Stripe(response.data.publishableKey);
              
              // Create payment element options
              const options = {
                mode: 'payment',
                amount: Math.round($scope.book.price * 100), // Convert to cents
                currency: 'myr',
                appearance: {
                  theme: 'stripe',
                  variables: {
                    colorPrimary: '#0066cc',
                  },
                },
              };
              
              // Create elements instance
              elements = stripe.elements(options);
              
              // Create and mount the Payment Element
              paymentElement = elements.create('payment');
              paymentElement.mount('#stripe-payment-element');
              
              // Handle real-time validation errors
              paymentElement.on('change', function(event) {
                const displayError = document.querySelector('.card-errors');
                if (event.error) {
                  displayError.textContent = event.error.message;
                } else {
                  displayError.textContent = '';
                }
              });
            } catch (error) {
              console.error('Error initializing Stripe:', error);
              showToast('Payment system not available. You can still place the order.', 'info');
            }
          }
        })
        .catch(function(error) {
          console.error('Error loading book details or initializing Stripe:', error);
          showToast('Payment system not available. You can still place the order.', 'info');
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
    
    // Function to create payment intent on the server
    function createPaymentIntent() {
      return $http.post('/api/create-payment-intent', {
        amount: Math.round($scope.book.price * 100),
        currency: 'myr'
      });
    }
    
    // Function to handle place order action
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

    // Function to place order with successful payment
    function placeOrderWithPayment(paymentIntentId) {
      const orderData = {
        bookId: parseInt(bookId),
        buyerId: $scope.user.id,
        paymentMethod: 'stripe',
        macAddress: $scope.macAddress,
        paymentIntentId: paymentIntentId
      };
      
      $http.post('/api/purchases/place-order', orderData)
        .then(function(response) {
          if (response && response.data.success) {
            showToast('Order placed successfully! Order ID: ' + response.data.orderId, 'success');
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
  }]);
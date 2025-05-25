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
    
    // Stripe variables
    let stripe = null;
    let elements = null;
    let card = null;
    let clientSecret = null;
    
    // Initialize MAC address
    $scope.macAddress = '';
    
    // Initialize modal state
    $scope.showInstructionModal = false;
    $scope.instructionType = '';
    
    // Payment processing state
    $scope.paymentProcessing = false;
    
    // Toggle mobile menu
    $scope.toggleMobileMenu = function() {
      $scope.mobileMenuOpen = !$scope.mobileMenuOpen;
    };
    
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
        case 'notifications':
          $window.location.href = '/public-messages';
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
            // Initialize Stripe after book details are loaded
            initializeStripe();
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

    // Function to initialize Stripe
    function initializeStripe() {
      // Fetch Stripe publishable key from server
      $http.get('/api/stripe-config')
        .then(function(response) {
          // Initialize Stripe.js with the publishable key
          stripe = Stripe(response.data.publishableKey);
          
          // Create payment intent on the server
          return createPaymentIntent();
        })
        .then(function() {
          // Create an instance of Elements
          elements = stripe.elements();
          
          // Create and mount the Card Element
          card = elements.create('card', {
            style: {
              base: {
                color: '#32325d',
                fontFamily: '"Helvetica Neue", Helvetica, sans-serif',
                fontSmoothing: 'antialiased',
                fontSize: '16px',
                '::placeholder': {
                  color: '#aab7c4'
                }
              },
              invalid: {
                color: '#fa755a',
                iconColor: '#fa755a'
              }
            }
          });
          
          // Mount the Card Element to the DOM
          card.mount('#card-element');
          
          // Handle real-time validation errors
          card.on('change', function(event) {
            const displayError = document.getElementById('card-errors');
            if (event.error) {
              displayError.textContent = event.error.message;
            } else {
              displayError.textContent = '';
            }
          });
        })
        .catch(function(error) {
          console.error('Error initializing Stripe:', error);
          showToast('Error initializing payment system', 'error');
        });
    }
    
    // Function to create a payment intent on the server
    function createPaymentIntent() {
      // Convert price to cents for Stripe
      const amount = Math.round($scope.book.price * 100);
      
      return $http.post('/api/create-payment-intent', {
        amount: amount,
        currency: 'myr' // Malaysian Ringgit
      })
      .then(function(response) {
        if (response.data.success) {
          clientSecret = response.data.clientSecret;
        } else {
          throw new Error(response.data.message || 'Error creating payment intent');
        }
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
    
    // Function to handle payment submission
    $scope.submitPayment = function() {
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
      
      // Set loading state
      $scope.paymentProcessing = true;
      
      // Execute the payment
      stripe.confirmCardPayment(clientSecret, {
        payment_method: {
          card: card,
          billing_details: {
            name: $scope.user.username
          }
        }
      })
      .then(function(result) {
        if (result.error) {
          // Show error to your customer
          console.error('Payment error:', result.error);
          showToast(result.error.message, 'error');
          $scope.paymentProcessing = false;
          $scope.$apply();
        } else {
          // The payment succeeded!
          if (result.paymentIntent.status === 'succeeded') {
            // Place the order with the server
            placeOrder(result.paymentIntent.id);
          }
        }
      });
    };

    // Function to place the order after successful payment
    function placeOrder(paymentIntentId) {
      const orderData = {
        bookId: parseInt(bookId),
        buyerId: $scope.user.id,
        paymentMethod: 'stripe',
        macAddress: $scope.macAddress,
        paymentIntentId: paymentIntentId
      };
      
      $http.post('/api/purchases/place-order', orderData)
        .then(function(response) {
          $scope.paymentProcessing = false;
          
          if (response && response.data.success) {
            showToast('Payment successful! Order placed. Order ID: ' + response.data.orderId, 'success');
            setTimeout(function() {
              $window.location.href = '/order';
            }, 3000);
          } else if (response) {
            showToast('Error: ' + response.data.message, 'error');
          }
          $scope.$apply();
        })
        .catch(function(error) {
          $scope.paymentProcessing = false;
          console.error('Error placing order:', error);
          showToast('Failed to place order. Please try again.', 'error');
          $scope.$apply();
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
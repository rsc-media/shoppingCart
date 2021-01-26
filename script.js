var shop = {}, // To be filled with Shop object
  templates = {}, // To be filled with templates
  clearLS, // To be filled with function to clear Local Storage key
  isCheckout = (window.location.pathname.split('/').pop() == "checkout.html");

// Track Elements for easier reference.
// els.fill() should be called after templates are loaded so new
// elements can be added and then referenced
var els = { // To be filled with Elements
  list: [ // Elements to fill into els when els.fill() is called
    "main", "gridBox", "logo", "name", "products", "cart", "cartHeader",
    "cartList", "cartTotals", "cartForm", "alert", "subtotal", "taxRate",
    "tax", "freeShippingMin", "shipping", "grandTotal",
    "hiddenStore", "hiddenOrder", "hiddenCart", "nav"
  ]
};
els.fill = function() { els.list.forEach(el => { els[el] = document.getElementById(el) }); }
els.fill();

// Fetch Shop and Template files and then Init the shopping cart
promiseFetchShop = fetch(new Request("./shop.json"))
  .then(response => response.json());
promiseFetchTemplates = fetch(new Request("./templates.html"))
  .then(response => response.text());

Promise.all([promiseFetchShop, promiseFetchTemplates])
  .then(init);

// Init
function init(data) {
  shop = data[0];
  const meta = [...document.getElementsByTagName("meta")].find(m => m.name == "category");
  const cat = (meta && meta.content) ? meta.content : "All";

  // Load templates
  templates.doc = new DOMParser().parseFromString(data[1], 'text/html');
  [ ...templates.doc.getElementsByTagName("template"),
    ...document.getElementsByTagName("template")
  ].forEach(t => { templates[t.id] = t });

  // Loud main template. fill els before and after
  els.main.innerHTML = templates.tMain.innerHTML;
  els.fill();

  // Set up header
  els.name.innerHTML = shop.name;
  els.logo.src = shop.logo;
  els.logo.alt = shop.logoAltText;

  // Nav
  shop.categories.forEach((cat) => {
    var page = location.pathname.split("/").pop() || "index.html";
    if (page == cat.page) {
      els.nav.innerHTML += "<span>" + cat.title + "</span>";
    } else {
      els.nav.innerHTML += "<a href='" + cat.page + "'>" + cat.title + "</a>";
    }
  })

  if (isCheckout) {
    // Set up header
    document.title = shop.name + " - Checkout";
    els.name.innerHTML += " - Checkout";
    // Remove div#products
    if (els.products) els.products.parentNode.removeChild(els.products);
  } else {
    // Set up header
    document.title = shop.name + " - Shop";
    // Construct product list
    var products = shop.products;
    if (cat != "All") products = products.filter(p => p.Category == cat);
    products.forEach(function(entry) {
      let item = document.createElement("div");
      item.classList.add("product");
      // Clone Template
      item.innerHTML = templates.tProduct.innerHTML;
      // Title
      item.getElementsByClassName('title')[0].innerHTML = entry.Title;
      // Image
      let img = item.querySelector('.image img');
      img.src = entry.Image;
      img.alt = entry.AltText;
      // Description
      item.getElementsByClassName('description')[0].innerHTML = entry.Description;
      // Options
      label = item.getElementsByClassName('optionsLabel')[0];
      select = item.getElementsByClassName('options')[0];
      select.id += "-" + entry.id;
      label.setAttribute("for", select.id);
      entry.Options.forEach(function(opt, idx) {
        let option = document.createElement('option');
        option.value = idx;
        option.innerText = opt;
        select.appendChild(option);
      });
      item.getElementsByClassName('price')[0].innerText = "$" + entry.Price.toFixed(2);
      // Button
      let addToCartButton = item.getElementsByClassName('addToCart')[0];
      addToCartButton.value = entry.id;
      addToCartButton.addEventListener("click", handleAddToCart);
      // Append to product list
      els.products.appendChild(item);
    });
    // Add event listener
    els.cart.addEventListener("change", cartChange);
  }

  // Reveal the product grid
  els.gridBox.style.display = "grid";

  // Local Storage
  clearLS = function() {
    window.localStorage.removeItem(shop.lsKey);
  };

  // Init the Cart
  var ls = window.localStorage.getItem(shop.lsKey);
  shop.cart = (ls) ? JSON.parse(ls) : [];
  refreshCart();
}
// Handles click of 'Add to Cart' buttons
function handleAddToCart(ev) {
  const pid = ev.srcElement.value;
  const opt = ev.srcElement.parentNode.parentNode.getElementsByClassName("options")[0].value;
  const product = shop.products.find(function(product) {
    return product.id === parseInt(pid, 10);
  });
  const option = product.Options[opt];
  const sku = pid + "-" + opt;
  const found = shop.cart.findIndex(isInCart, sku);
  if (found > -1) {
    shop.cart[found].quantity++; // If item is already in cart, add quantity
  } else {
    shop.cart.push({pid, opt, sku, "quantity": 1});
  }
  // Alert
  els.alert.innerText = product.Title + " " + option + " added to the shopping cart.";
  window.clearTimeout(shop.alertTO);
  shop.alertTO = setTimeout(function() { els.alert.innerText = '' }, 3000);
  // Refresh cart
  refreshCart();
}
// Clear cart from memory and cache, and then refresh display
function emptyCart() {
  clearLS();
  shop.cart = [];
  refreshCart();
}
// Handle a number value being changed on an input in the cart
function cartChange(ev) {
  const sku = ev.srcElement.id.replace("-qty","");
  const found = shop.cart.findIndex(isInCart, sku);
  const newVal = parseInt(ev.srcElement.value);
  if (newVal <= 0) { //Remove item from cart
    shop.cart.splice(found, 1);
  } else {
    shop.cart[found].quantity = newVal;
  }
  refreshCart();
}
// Process the cart and make the cart reflect it's current status
function refreshCart() {
  // Check if cart is empty
  if (shop.cart.length === 0) {
    els.cartList.innerHTML = templates.tCartEmpty.innerHTML;
    els.cartTotals.innerHTML = "";
    els.cartForm.innerHTML = "";
  // If cart is not empty
  } else {
    // Reset totals
    shop.cart.subtotal = shop.cart.tax = shop.cart.shipping = shop.cart.grandTotal = 0;

    // See if the cart is not currently displayed, load the template
    if (els.cartList.getElementsByTagName("table").length == 0)
      els.cartList.innerHTML = templates.tCartList.innerHTML;

    // Header
    var tbody = els.cartList.getElementsByTagName("tbody")[0];
    var tempTbody = document.createElement("tbody");
    var prevTR;

    // Sort and then iterate through the cart
    shop.cart.sort((a, b) => (a.sku > b.sku) ? 1 : -1);
    shop.cart.forEach(function(item) {
      var trs = tbody.getElementsByTagName("tr");
      var tr;
      // See if it is already displayed
      var tr = trs.length > 0 && [...trs].find(findDisplayed.bind(item));
      // Else, Create row
      if (!tr) {
        tempTbody.innerHTML = templates.tCartItem.innerHTML;
        tr = tempTbody.getElementsByTagName("tr")[0];
        if (prevTR && prevTR.nextSibling) {
          tbody.insertBefore(tr, prevTR.nextSibling);
        } else {
          tbody.appendChild(tr);
        }
      } else {
        prevTR = tr;
      }

      var tds = tr.getElementsByTagName("td");

      var product = shop.products.find(function(product) {
        return product.id === parseInt(item.pid, 10);
      });
      // Product
      tds[0].id = "cart-" + item.sku;
      tds[0].innerHTML = product.Title + " " + product.Options[item.opt];
      // Quantity
      if (isCheckout) {
        tds[1].innerText = item.quantity;
        tds[1].setAttribute("aria-labelledby",tds[0].id + " cart-qty")
      } else {
        let input = tds[1].getElementsByTagName("input")[0];
        input.id = item.sku + "-qty"
        input.setAttribute("aria-labelledby",tds[0].id + " cart-qty");
        input.value = item.quantity;
      }
      // Price
      tds[2].innerHTML = "$&nbsp;" + (item.quantity * product.Price).toFixed(2);
      tds[2].setAttribute("aria-labelledby", tds[0].id + " cart-price")
      shop.cart.subtotal += (item.quantity * product.Price);
    });

    // Remove items with a quantity of 0 from the displayed cart
    if (!isCheckout) {
      // for (let tr of tbody.getElementsByTagName("tr")) {
      [...tbody.getElementsByTagName("tr")].forEach(tr => {
        var qty = tr.querySelector("td:nth-of-type(2) input").value;
        if (qty <= 0) {
          tr.parentNode.removeChild(tr);
        }
      });
    }

    // Fill footer elements
    if (els.cartTotals.innerHTML == "")
      els.cartTotals.innerHTML = templates.tCartTotals.innerHTML;
    if (els.cartForm.innerHTML == "")
      els.cartForm.innerHTML = templates.tCartForm.innerHTML;
    els.fill();

    // Calculate totals
    shop.cart.tax = shop.cart.subtotal * shop.taxRate;
    shop.cart.shipping = (shop.cart.subtotal >= shop.freeShippingMin) ? 0 : 10;
    shop.cart.grandTotal = shop.cart.subtotal + shop.cart.tax + shop.cart.shipping;

    // Fill totals
    els.subtotal.innerHTML = "$&nbsp;" + shop.cart.subtotal.toFixed(2)
    els.taxRate.innerHTML = shop.taxRate * 100;
    els.tax.innerHTML = shop.cart.tax.toFixed(2)
    els.freeShippingMin.innerHTML = shop.freeShippingMin
    els.shipping.innerHTML = shop.cart.shipping.toFixed(2)
    els.grandTotal.innerHTML = "$&nbsp;" + shop.cart.grandTotal.toFixed(2)

    // Fill hidden form fields
    if (isCheckout) {
      els.hiddenStore.value = shop.name;
      els.hiddenOrder.value = Math.random().toString(36).substr(2, 9);
      els.hiddenCart.value = JSON.stringify(shop.cart);
    }
  }

  if (isCheckout && history.length <= 1) {
    let back = document.getElementById('back');
    if (back) back.parentNode.removeChild(back);
  }

  // Update Local Storage
  window.localStorage.setItem(shop.lsKey, JSON.stringify(shop.cart));
}

// [].findIndex function - checks if item is in the cart object
function isInCart(el, index, array) {
  return el.sku == this.toString();
}
// [].find function - checks if item matches TR in displayed cart
function findDisplayed(el, index, array) {
  return el.firstElementChild.id.endsWith(this.sku);
}
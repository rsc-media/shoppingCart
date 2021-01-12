# Example Shopping Cart
Made for us in CIS programming courses.

## File structure and purpose
* templates.html - Shared layout templates for various parts of the pages.  Most HTML would be edited here, not in the base HTML files below.  Templates cascade like CSS, so a template in a base HTML would override a template declared in this file.  This is used in checkouts.html to customize a few areas.
* index.html     - Index \ Product page.
* checkout.html  - Checkout page.  Contains some template overrides and a different CSS link, otherwise almost identical to index.html
* style.css      - Main CSS
* checkout.css   - Cascading overrides for checkout.html.  @Imports style.css
* script.js      - Main script file for both pages.
* shop.json      - Shop configuration file.  Defines Title, Logo, tax rate, free shipping threashold, and inventory.

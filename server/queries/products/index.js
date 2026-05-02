// Barrel module re-exporting every product-related SQL string.
// Each sub-file groups one feature (search, deals, browse listings, detail
// page, trending, value rankings) and contains both its original and its
// optimized variant so the optimization deltas are easy to read side by side.

module.exports = {
  ...require('./search.sql'),
  ...require('./deals.sql'),
  ...require('./browse.sql'),
  ...require('./detail.sql'),
  ...require('./trending.sql'),
  ...require('./value.sql')
};

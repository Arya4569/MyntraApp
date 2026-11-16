const Address = require('../models/Address');

/**
 * GET /api/addresses
 * Retrieve all delivery addresses for the currently authenticated user
 */
exports.getAddresses = async (req, res) => {
  try {
    const userId = req.user.id;
    const addresses = Address.findByUserId(userId);

    return res.status(200).json({
      success: true,
      addresses,
      count: addresses.length,
    });
  } catch (err) {
    console.error('Error fetching addresses:', err);
    return res.status(500).json({
      success: false,
      error: 'Failed to retrieve addresses.',
    });
  }
};

/**
 * POST /api/addresses
 * Create a new delivery address for the authenticated user
 */
exports.createAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const result = Address.create(userId, req.body);

    return res.status(201).json({
      success: true,
      message: 'Address saved successfully.',
      address: result.address,
      addresses: result.addresses,
    });
  } catch (err) {
    console.error('Error creating address:', err);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Failed to create address.',
    });
  }
};

/**
 * PUT /api/addresses/:id
 * PATCH /api/addresses/:id
 * Update an existing delivery address with ownership verification
 */
exports.updateAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = Address.update(id, userId, req.body);

    return res.status(200).json({
      success: true,
      message: 'Address updated successfully.',
      address: result.address,
      addresses: result.addresses,
    });
  } catch (err) {
    console.error('Error updating address:', err);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Failed to update address.',
    });
  }
};

/**
 * DELETE /api/addresses/:id
 * Delete a delivery address with ownership verification
 */
exports.deleteAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = Address.delete(id, userId);

    return res.status(200).json({
      success: true,
      message: 'Address deleted successfully.',
      addresses: result.addresses,
    });
  } catch (err) {
    console.error('Error deleting address:', err);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Failed to delete address.',
    });
  }
};

/**
 * PATCH /api/addresses/:id/default
 * PUT /api/addresses/:id/default
 * Set address as default delivery address for current user
 */
exports.setDefaultAddress = async (req, res) => {
  try {
    const userId = req.user.id;
    const { id } = req.params;

    const result = Address.setDefault(id, userId);

    return res.status(200).json({
      success: true,
      message: 'Default address updated successfully.',
      addresses: result.addresses,
    });
  } catch (err) {
    console.error('Error setting default address:', err);
    return res.status(err.status || 500).json({
      success: false,
      error: err.message || 'Failed to set default address.',
    });
  }
};

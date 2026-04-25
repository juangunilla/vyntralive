const Report = require('../models/Report');

const createReport = async (req, res, next) => {
  try {
    const { reportedUserId, reason, description } = req.body;
    if (!reportedUserId || !reason) {
      return res.status(400).json({ message: 'reportedUserId y reason son requeridos' });
    }
    const report = await Report.create({
      reporter: req.user._id,
      reportedUser: reportedUserId,
      reason,
      description,
    });
    res.status(201).json(report);
  } catch (error) {
    next(error);
  }
};

const getReports = async (req, res, next) => {
  try {
    const reports = await Report.find().populate('reporter', 'name email').populate('reportedUser', 'name email');
    res.json(reports);
  } catch (error) {
    next(error);
  }
};

module.exports = { createReport, getReports };

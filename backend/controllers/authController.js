const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const {
  STARTING_CREDITS,
  ensureCreditsInitialized,
  serializePublicUser,
  recordWelcomeCredits,
} = require('../services/credits');

const signToken = (userId) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES || '7d',
  });
};

const register = async (req, res, next) => {
  try {
    const { name, email, password, role } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Todos los campos son obligatorios' });
    }
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({ message: 'Email ya registrado' });
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role === 'creator' ? 'creator' : 'user',
      credits: STARTING_CREDITS,
      totalCreditsEarned: STARTING_CREDITS,
      totalCreditsSpent: 0,
    });
    await recordWelcomeCredits(user);
    const token = signToken(user._id);
    res.status(201).json({
      user: serializePublicUser(user),
      token,
    });
  } catch (error) {
    next(error);
  }
};

const login = async (req, res, next) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ message: 'Email y contraseña son requeridos' });
    }
    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Credenciales inválidas' });
    }
    await ensureCreditsInitialized(user);
    const token = signToken(user._id);
    res.json({
      user: serializePublicUser(user),
      token,
    });
  } catch (error) {
    next(error);
  }
};

module.exports = { register, login };

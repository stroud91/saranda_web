"use client";

const authMiddleware = (req, res, next) => {
  const user = req.session.user;

  if (!user) {
    return res.status(401).json({ message: 'Unauthorized' });
  }

  next();
};
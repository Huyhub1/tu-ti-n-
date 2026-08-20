import mongoose from 'mongoose';

const SectSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  leaderId: { type: String, required: true },
  leaderName: { type: String, required: true },
  faction: { type: String, enum: ['CHINH_DAO', 'MA_DAO', 'TAN_TU'], default: 'TAN_TU' },
  level: { type: Number, default: 1 },
  reputation: { type: Number, default: 0 },
  treasury: {
    linhThach: { type: Number, default: 0 }
  },
  members: [{
    userId: { type: String, required: true },
    username: { type: String, required: true },
    role: { type: String, enum: ['LEADER', 'ELDER', 'MEMBER'], default: 'MEMBER' },
    contribution: { type: Number, default: 0 },
    joinedAt: { type: Date, default: Date.now }
  }],
  arrayLevel: { type: Number, default: 1 }, // Hộ Tông Đại Trận
  desc: { type: String, default: 'Một môn phái mới nổi trên tu chân giới.' }
}, { timestamps: true });

export const Sect = mongoose.model('Sect', SectSchema);

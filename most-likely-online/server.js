const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new server(server, {
  cors: { origin: '*' }
});

app.use(express.static(path.join(__dirname, 'public')));

const questions = [
  { q: "مين أكتر واحد فينا بيعاند؟", emoji: "😤" },
  { q: "مين أكتر واحد بيعطلنا قبل النزول؟", emoji: "⏰" },
  { q: "مين أكتر واحد بينام وهو بيكلم التاني؟", emoji: "😴" },
  { q: "مين أكتر واحد بيرسل رسائل كتير أوي؟", emoji: "💌" },
  { q: "مين أكتر واحد بيتخانق في الشارع؟", emoji: "🗣️" },
  { q: "مين أكتر واحد بياكل أكل التاني؟", emoji: "🍰" },
  { q: "مين أكتر واحد بيعمل مفاجآت؟", emoji: "🎁" },
  { q: "مين أكتر واحد بيحب يحضن؟", emoji: "🤗" },
  { q: "مين أكتر واحد بيتكلم في التليفون كتير؟", emoji: "📱" },
  { q: "مين أكتر واحد بيتأخر على المواعيد؟", emoji: "🏃" },
  { q: "مين أكتر واحد بيبكي في الأفلام؟", emoji: "😭" },
  { q: "مين أكتر واحد بيهمه التفاصيل الصغيرة؟", emoji: "🔍" },
  { q: "مين أكتر واحد بيفتكر المناسبات المهمة؟", emoji: "📅" },
  { q: "مين أكتر واحد بيغير أكتر؟", emoji: "😒" },
  { q: "مين أكتر واحد بيضحك بصوت عالي؟", emoji: "😂" },
  { q: "مين أكتر واحد بيقضي وقت في المطبخ؟", emoji: "👨‍🍳" },
  { q: "مين أكتر واحد بيقعد عالنت بليل؟", emoji: "🌙" },
  { q: "مين أكتر واحد بيحب يchange the mood؟", emoji: "🎵" },
  { q: "مين أكتر واحد بيتعمله حركات رومانسية؟", emoji: "🌹" },
  { q: "مين أكتر واحد بيتكلم عن المستقبل؟", emoji: "🔮" },
  { q: "مين أكتر واحد بيحتفل بأي مناسبة؟", emoji: "🎉" },
  { q: "مين أكتر واحد بيحب يتصور مع التاني؟", emoji: "📸" },
  { q: "مين أكتر واحد بيراعي صحته أكتر؟", emoji: "💪" },
  { q: "مين أكتر واحد بيحب يسمع كلام حلو؟", emoji: "🥰" },
  { q: "مين أكتر واحد بيغير من أصحاب التاني؟", emoji: "👀" },
  { q: "مين أكتر واحد بينسى يرد على الرسايل؟", emoji: "💭" },
  { q: "مين أكتر واحد بيحب النوم أكتر؟", emoji: "😴" },
  { q: "مين أكتر واحد بيعيش اللحظة؟", emoji: "⚡" },
  { q: "مين أكتر واحد بيهتم بالparsed打扮؟", emoji: "💄" },
  { q: "مين أكتر واحد بيحلم بالجواز؟", emoji: "💒" }
];

const rooms = {};

function generateCode() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function shuffleArray(arr) {
  const shuffled = [...arr];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);
  let currentRoom = null;
  let currentPlayer = null;

  socket.on('create-room', ({ playerName }, callback) => {
    let code = generateCode();
    while (rooms[code]) code = generateCode();

    const shuffled = shuffleArray(questions);
    rooms[code] = {
      code,
      host: socket.id,
      hostName: playerName,
      joiner: null,
      joinerName: null,
      status: 'waiting',
      questions: shuffled,
      currentQ: 0,
      votes: {},
      scores: { p1: 0, p2: 0 },
      totalQuestions: 30
    };

    currentRoom = code;
    currentPlayer = 1;
    socket.join(code);

    callback({ success: true, code, playerNum: 1 });
  });

  socket.on('join-room', ({ roomCode, playerName }, callback) => {
    const code = roomCode.trim();
    const room = rooms[code];

    if (!room) {
      return callback({ success: false, error: 'الغرفة مش موجودة! تأكد من الكود.' });
    }
    if (room.joiner) {
      return callback({ success: false, error: 'الغرفة مليانة! في حد تاني معاكم.' });
    }

    room.joiner = socket.id;
    room.joinerName = playerName;
    room.status = 'ready';

    currentRoom = code;
    currentPlayer = 2;
    socket.join(code);

    callback({ success: true, code, playerNum: 2 });
    io.to(code).emit('player-joined', {
      hostName: room.hostName,
      joinerName: room.joinerName
    });
  });

  socket.on('start-game', () => {
    const room = rooms[currentRoom];
    if (!room || socket.id !== room.host) return;

    room.status = 'playing';
    room.currentQ = 0;
    room.votes = {};
    room.scores = { p1: 0, p2: 0 };

    io.to(currentRoom).emit('game-started', {
      questions: room.questions.map(q => ({ q: q.q, emoji: q.emoji })),
      totalQuestions: room.totalQuestions,
      hostName: room.hostName,
      joinerName: room.joinerName
    });

    io.to(currentRoom).emit('new-question', {
      question: room.questions[0].q,
      emoji: room.questions[0].emoji,
      questionNum: 1,
      totalQuestions: room.totalQuestions
    });
  });

  socket.on('vote', ({ questionIndex, votedFor }) => {
    const room = rooms[currentRoom];
    if (!room || room.status !== 'playing') return;

    if (!room.votes[questionIndex]) {
      room.votes[questionIndex] = {};
    }

    const playerKey = socket.id === room.host ? 'p1' : 'p2';
    room.votes[questionIndex][playerKey] = votedFor;

    io.to(currentRoom).emit('vote-update', {
      questionIndex,
      votes: room.votes[questionIndex],
      hostName: room.hostName,
      joinerName: room.joinerName
    });

    const votes = room.votes[questionIndex];
    if (votes.p1 !== undefined && votes.p2 !== undefined) {
      if (votes.p1 === votes.p2) {
        const winner = votes.p1;
        if (winner === 1) room.scores.p1++;
        else room.scores.p2++;
      } else {
        room.scores.p1++;
        room.scores.p2++;
      }

      setTimeout(() => {
        io.to(currentRoom).emit('both-voted', {
          votes: room.votes[questionIndex],
          scores: room.scores,
          hostName: room.hostName,
          joinerName: room.joinerName
        });
      }, 1500);
    }
  });

  socket.on('skip-question', ({ questionIndex }) => {
    const room = rooms[currentRoom];
    if (!room || room.status !== 'playing') return;

    if (!room.votes[questionIndex]) {
      room.votes[questionIndex] = {};
    }

    const playerKey = socket.id === room.host ? 'p1' : 'p2';
    room.votes[questionIndex][playerKey] = 'skip';

    io.to(currentRoom).emit('vote-update', {
      questionIndex,
      votes: room.votes[questionIndex],
      hostName: room.hostName,
      joinerName: room.joinerName
    });

    const votes = room.votes[questionIndex];
    if (votes.p1 !== undefined && votes.p2 !== undefined) {
      setTimeout(() => {
        advanceQuestion();
      }, 500);
    }
  });

  function advanceQuestion() {
    const room = rooms[currentRoom];
    if (!room) return;

    room.currentQ++;

    if (room.currentQ >= room.totalQuestions) {
      room.status = 'finished';

      const questionResults = room.questions.map((q, i) => ({
        question: q.q,
        emoji: q.emoji,
        votes: room.votes[i] || {}
      }));

      io.to(currentRoom).emit('game-over', {
        scores: room.scores,
        hostName: room.hostName,
        joinerName: room.joinerName,
        questionResults
      });
      return;
    }

    io.to(currentRoom).emit('new-question', {
      question: room.questions[room.currentQ].q,
      emoji: room.questions[room.currentQ].emoji,
      questionNum: room.currentQ + 1,
      totalQuestions: room.totalQuestions
    });
  }

  socket.on('next-question', () => {
    const room = rooms[currentRoom];
    if (!room || socket.id !== room.host) return;
    advanceQuestion();
  });

  socket.on('play-again', () => {
    const room = rooms[currentRoom];
    if (!room) return;

    room.status = 'waiting';
    room.currentQ = 0;
    room.votes = {};
    room.scores = { p1: 0, p2: 0 };
    room.questions = shuffleArray(questions);

    io.to(currentRoom).emit('back-to-waiting', {
      hostName: room.hostName,
      joinerName: room.joinerName
    });
  });

  socket.on('disconnect', () => {
    console.log('User disconnected:', socket.id);
    if (currentRoom && rooms[currentRoom]) {
      const room = rooms[currentRoom];
      const isHost = socket.id === room.host;
      const isJoiner = socket.id === room.joiner;

      if (isHost || isJoiner) {
        const otherSocket = isHost ? room.joiner : room.host;
        if (otherSocket) {
          io.to(otherSocket).emit('partner-disconnected', {
            name: isHost ? room.hostName : room.joinerName
          });
        }

        if (isHost) {
          room.host = null;
        } else {
          room.joiner = null;
          room.joinerName = null;
          room.status = 'waiting';
        }

        if (!room.host && !room.joiner) {
          delete rooms[currentRoom];
        }
      }
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

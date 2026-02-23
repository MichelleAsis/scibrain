// backend/database/service-turso.js - Turso (libSQL) for Vercel/serverless
const { createClient } = require('@libsql/client');
const fs = require('fs');
const path = require('path');

const SCHEMA_PATH = path.join(__dirname, 'schema.sql');

class TursoDatabaseService {
    constructor() {
        this.client = null;
        this.schemaDone = false;
    }

    connect() {
        if (this.client) return this.client;
        const url = process.env.TURSO_DATABASE_URL;
        const authToken = process.env.TURSO_AUTH_TOKEN;
        if (!url || !authToken) throw new Error('TURSO_DATABASE_URL and TURSO_AUTH_TOKEN are required');
        this.client = createClient({ url, authToken });
        return this.client;
    }

    async ensureSchema() {
        if (this.schemaDone) return;
        const client = this.connect();
        const schema = fs.readFileSync(SCHEMA_PATH, 'utf8');
        const statements = schema
            .split(';')
            .map(s => s.trim())
            .filter(s => s.length > 0 && !s.startsWith('--'));
        for (const sql of statements) {
            await client.execute(sql);
        }
        this.schemaDone = true;
    }

    async deleteExpiredSessions() {
        await this.ensureSchema();
        const r = await this.connect().execute(
            "DELETE FROM sessions WHERE expires_at <= datetime('now')"
        );
        if (r.rowsAffected > 0) console.log(`🗑️ Deleted ${r.rowsAffected} expired sessions`);
    }

    async getSessionByToken(sessionToken) {
        await this.ensureSchema();
        const r = await this.connect().execute({
            sql: `SELECT s.*, u.full_name, u.email 
                  FROM sessions s JOIN users u ON s.user_id = u.id
                  WHERE s.session_token = ? AND s.expires_at > datetime('now')`,
            args: [sessionToken]
        });
        return r.rows[0] ? rowToObject(r.rows[0], r.columns) : null;
    }

    async getUserByEmail(email) {
        await this.ensureSchema();
        const r = await this.connect().execute({
            sql: 'SELECT * FROM users WHERE email = ?',
            args: [email]
        });
        return r.rows[0] ? rowToObject(r.rows[0], r.columns) : null;
    }

    async getUserById(userId) {
        await this.ensureSchema();
        const r = await this.connect().execute({
            sql: 'SELECT * FROM users WHERE id = ?',
            args: [userId]
        });
        return r.rows[0] ? rowToObject(r.rows[0], r.columns) : null;
    }

    async createUser(fullName, email, passwordHash) {
        await this.ensureSchema();
        const r = await this.connect().execute({
            sql: 'INSERT INTO users (full_name, email, password_hash) VALUES (?, ?, ?)',
            args: [fullName, email, passwordHash]
        });
        const id = Number(r.lastInsertRowid ?? 0);
        console.log(`✅ User created: ID ${id}, Email: ${email}`);
        return id;
    }

    async updateLastLogin(userId) {
        await this.ensureSchema();
        await this.connect().execute({
            sql: "UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?",
            args: [userId]
        });
    }

    async createSession(userId, sessionToken, expiresAt) {
        await this.ensureSchema();
        const r = await this.connect().execute({
            sql: 'INSERT INTO sessions (user_id, session_token, expires_at) VALUES (?, ?, ?)',
            args: [userId, sessionToken, expiresAt]
        });
        console.log(`✅ Session created for user ${userId}`);
        return Number(r.lastInsertRowid ?? 0);
    }

    async deleteSession(sessionToken) {
        await this.ensureSchema();
        await this.connect().execute({
            sql: 'DELETE FROM sessions WHERE session_token = ?',
            args: [sessionToken]
        });
    }

    async saveDocument(userId, title, originalText, fileType = 'text') {
        await this.ensureSchema();
        const wordCount = originalText.split(/\s+/).length;
        const r = await this.connect().execute({
            sql: 'INSERT INTO documents (user_id, title, original_text, file_type, word_count) VALUES (?, ?, ?, ?, ?)',
            args: [userId, title, originalText, fileType, wordCount]
        });
        console.log(`✅ Document saved: ID ${r.lastInsertRowid} for user ${userId}`);
        return Number(r.lastInsertRowid ?? 0);
    }

    async saveReviewer(userId, documentId, reviewerData) {
        await this.ensureSchema();
        const r = await this.connect().execute({
            sql: `INSERT INTO reviewers (user_id, document_id, title, sections, concepts, metadata, original_text)
                  VALUES (?, ?, ?, ?, ?, ?, ?)`,
            args: [
                userId,
                documentId,
                reviewerData.title,
                JSON.stringify(reviewerData.sections),
                JSON.stringify(reviewerData.concepts),
                JSON.stringify(reviewerData.metadata),
                reviewerData.originalText
            ]
        });
        const id = Number(r.lastInsertRowid ?? 0);
        console.log(`✅ Reviewer saved: ID ${id} for user ${userId}`);
        return id;
    }

    async saveQuizQuestions(reviewerId, allQuestions) {
        await this.ensureSchema();
        const client = this.connect();
        for (const [quizType, difficulties] of Object.entries(allQuestions)) {
            for (const [difficulty, questionData] of Object.entries(difficulties)) {
                await client.execute({
                    sql: 'INSERT INTO quiz_questions (reviewer_id, quiz_type, difficulty, questions) VALUES (?, ?, ?, ?)',
                    args: [reviewerId, quizType, difficulty, JSON.stringify(questionData)]
                });
            }
        }
        console.log(`✅ Quiz questions saved for reviewer: ${reviewerId}`);
        return true;
    }

    async getAllReviewers(userId, limit = 50) {
        await this.ensureSchema();
        const r = await this.connect().execute({
            sql: `SELECT r.id, r.title, r.generated_at, d.title as document_title,
                  json_extract(r.metadata, '$.wordCount') as word_count
                  FROM reviewers r LEFT JOIN documents d ON r.document_id = d.id
                  WHERE r.user_id = ? ORDER BY r.generated_at DESC LIMIT ?`,
            args: [userId, limit]
        });
        return r.rows.map(row => rowToObject(row, r.columns));
    }

    async getReviewer(id, userId = null) {
        await this.ensureSchema();
        let r;
        if (userId) {
            r = await this.connect().execute({
                sql: 'SELECT * FROM reviewers WHERE id = ? AND user_id = ?',
                args: [id, userId]
            });
        } else {
            r = await this.connect().execute({
                sql: 'SELECT * FROM reviewers WHERE id = ?',
                args: [id]
            });
        }
        const row = r.rows[0];
        if (!row) return null;
        const o = rowToObject(row, r.columns);
        return {
            id: o.id,
            userId: o.user_id,
            documentId: o.document_id,
            title: o.title,
            sections: typeof o.sections === 'string' ? JSON.parse(o.sections) : o.sections,
            concepts: typeof o.concepts === 'string' ? JSON.parse(o.concepts) : o.concepts,
            metadata: typeof o.metadata === 'string' ? JSON.parse(o.metadata) : o.metadata,
            originalText: o.original_text,
            generatedAt: o.generated_at
        };
    }

    async deleteReviewer(id, userId) {
        await this.ensureSchema();
        const r = await this.connect().execute({
            sql: 'DELETE FROM reviewers WHERE id = ? AND user_id = ?',
            args: [id, userId]
        });
        console.log(`🗑️ Reviewer deleted: ID ${id}`);
        return (r.rowsAffected ?? 0) > 0;
    }

    async getQuizQuestions(reviewerId) {
        await this.ensureSchema();
        const r = await this.connect().execute({
            sql: 'SELECT quiz_type, difficulty, questions FROM quiz_questions WHERE reviewer_id = ?',
            args: [reviewerId]
        });
        const allQuestions = {
            trueFalse: { easy: [], medium: [], hard: [] },
            multipleChoice: { easy: [], medium: [], hard: [] },
            identification: { easy: [], medium: [], hard: [] },
            matching: { easy: { pairs: [] }, medium: { pairs: [] }, hard: { pairs: [] } }
        };
        for (const row of r.rows) {
            const o = rowToObject(row, r.columns);
            allQuestions[o.quiz_type][o.difficulty] = typeof o.questions === 'string' ? JSON.parse(o.questions) : o.questions;
        }
        return allQuestions;
    }

    async getStatistics(userId) {
        await this.ensureSchema();
        const client = this.connect();
        const docs = await client.execute({ sql: 'SELECT COUNT(*) as count FROM documents WHERE user_id = ?', args: [userId] });
        const revs = await client.execute({ sql: 'SELECT COUNT(*) as count FROM reviewers WHERE user_id = ?', args: [userId] });
        const attempts = await client.execute({ sql: 'SELECT COUNT(*) as count FROM quiz_attempts WHERE user_id = ?', args: [userId] });
        const anns = await client.execute({ sql: 'SELECT COUNT(*) as count FROM annotations WHERE user_id = ?', args: [userId] });
        const avg = await client.execute({ sql: 'SELECT AVG(percentage) as avg FROM quiz_attempts WHERE user_id = ?', args: [userId] });
        return {
            documents: Number(docs.rows[0]?.count ?? 0),
            reviewers: Number(revs.rows[0]?.count ?? 0),
            quizAttempts: Number(attempts.rows[0]?.count ?? 0),
            annotations: Number(anns.rows[0]?.count ?? 0),
            avgQuizScore: Number(avg.rows[0]?.avg ?? 0)
        };
    }

    async saveQuizAttempt(userId, reviewerId, attemptData) {
        await this.ensureSchema();
        const r = await this.connect().execute({
            sql: `INSERT INTO quiz_attempts (user_id, reviewer_id, quiz_type, difficulty, total_questions, correct_answers, wrong_answers, percentage, time_taken, user_answers, questions_used)
                  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            args: [
                userId,
                reviewerId,
                attemptData.quizType,
                attemptData.difficulty,
                attemptData.totalQuestions,
                attemptData.correctAnswers,
                attemptData.wrongAnswers,
                attemptData.percentage,
                attemptData.timeTaken,
                JSON.stringify(attemptData.userAnswers || []),
                JSON.stringify(attemptData.questionsUsed || [])
            ]
        });
        console.log(`✅ Quiz attempt saved: ID ${r.lastInsertRowid}`);
        return Number(r.lastInsertRowid ?? 0);
    }
}

function rowToObject(row, columns) {
    if (row && typeof row === 'object' && !Array.isArray(row)) return row;
    const o = {};
    columns.forEach((col, i) => { o[col] = row[i]; });
    return o;
}

const dbService = new TursoDatabaseService();
module.exports = dbService;

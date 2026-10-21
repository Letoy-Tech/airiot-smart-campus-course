-- Teacher database template. Not executed by first-chain.
CREATE TABLE course_campus (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    UNIQUE KEY uk_course_campus_name (name)
);

 
-- 数据库 mysql 库表以及索引大小查询
 
-- 查看指定库的大小
SELECT CONCAT(ROUND(SUM(DATA_LENGTH/1024/1024),2),'MB') AS DATA  FROM TABLES WHERE table_schema='testschema';
-- 查看指定库的指定表的大小
SELECT CONCAT(ROUND(SUM(DATA_LENGTH/1024/1024),2),'MB') AS DATA  FROM TABLES WHERE table_schema='testschema' AND table_name='t_syt_keyword_off_rep';
-- 查看指定库的索引大小
SELECT CONCAT(ROUND(SUM(index_length)/(1024*1024), 2), ' MB') AS 'Total Index Size' FROM TABLES  WHERE table_schema = 'testschema'; 
-- 查看指定库的指定表的索引大小
SELECT CONCAT(ROUND(SUM(index_length)/(1024*1024), 2), ' MB') AS 'Total Index Size' FROM TABLES  WHERE table_schema = 'testschema' AND table_name='tab_user'; 
 
 
-- 1.查看指定库数据和索引大小总和
SELECT CONCAT(ROUND(SUM((data_length+index_length)/1024/1024),2),'MB') AS total_data FROM information_schema.TABLES WHERE table_schema = 'testschema';
 
-- 2.查看所有库数据和索引大小总和
SELECT CONCAT(ROUND(SUM((data_length+index_length)/1024/1024),2),'MB') AS total_data FROM information_schema.TABLES;
 
-- 3.查看指定数据库的某个表
SELECT CONCAT(ROUND(SUM((data_length+index_length)/1024/1024),2),'MB') AS DATA FROM TABLES WHERE table_schema='testschema' AND table_name='tab_user';
 
-- 4.查询一个库中每个表的数据大小，索引大小和总大小
SELECT
CONCAT(a.table_schema,'.',a.table_name),
CONCAT(ROUND(table_rows/1000,4),'KB') AS 'Number of Rows',
CONCAT(ROUND(data_length/(1024*1024),4),',') AS 'data_size',
CONCAT(ROUND(index_length/(1024*1024),4),'M') AS 'index_size',
CONCAT(ROUND((data_length+index_length)/(1024*1024),4),'M') AS'Total'
FROM
information_schema. TABLES a
WHERE
a.table_schema = 'testschema';
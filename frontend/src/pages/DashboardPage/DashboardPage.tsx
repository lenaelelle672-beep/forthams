/**
 * DashboardPage - 仪表板数据看板主页面
 * 
 * 功能：展示资产总览统计、分类分布图表、维保到期预警卡片
 * 使用户能够在首页实时掌握资产整体状况
 */
import React from 'react';
import { AssetOverviewStat } from './components/AssetOverviewStat/AssetOverviewStat';
import { AssetCategoryChart } from './components/AssetCategoryChart/AssetCategoryChart';
import { MaintenanceAlertCard } from './components/MaintenanceAlertCard/MaintenanceAlertCard';
import styles from './DashboardPage.module.css';

/**
 * 仪表板数据看板主页面组件
 * 
 * @description 整合资产总览统计、分类分布图表、维保到期预警卡片三大核心组件
 * 为用户提供实时、直观的资产整体状况展示
 */
export const DashboardPage: React.FC = () => {
  return (
    <div className={styles.dashboardContainer}>
      <h1 className={styles.pageTitle}>资产总览</h1>
      
      {/* 资产总览统计区域 */}
      <section className={styles.overviewSection}>
        <AssetOverviewStat />
      </section>

      {/* 分类分布图表区域 */}
      <section className={styles.chartSection}>
        <AssetCategoryChart />
      </section>

      {/* 维保到期预警卡片区域 */}
      <section className={styles.alertSection}>
        <MaintenanceAlertCard />
      </section>
    </div>
  );
};

export default DashboardPage;
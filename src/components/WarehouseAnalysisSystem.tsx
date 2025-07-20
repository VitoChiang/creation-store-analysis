import React, { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import * as XLSX from 'xlsx';
import _ from 'lodash';

const WarehouseAnalysisSystem = () => {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState('pie');
  const [expandedCategories, setExpandedCategories] = useState<Record<string, boolean>>({});
  const [expandedWarehouse2024, setExpandedWarehouse2024] = useState<Record<string, boolean>>({});
  const [expandedWarehouse2025, setExpandedWarehouse2025] = useState<Record<string, boolean>>({});
  const [selectedPieCategory, setSelectedPieCategory] = useState<any>(null);

  useEffect(() => { loadAndProcessData(); }, []);

  const loadAndProcessData = async () => {
    try {
      setLoading(true);
      // 檢查是否在 GitHub Pages 環境
      const isProduction = window.location.hostname === 'vitochiang.github.io';
      const basePath = isProduction ? '/creation-store-analysis/' : '/';
      const response = await fetch(`${basePath}data-07-19.xlsx`);
      const arrayBuffer = await response.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { cellStyles: true, cellFormula: true, cellDates: true, cellNF: true, sheetStubs: true });
      
      const mergeData = XLSX.utils.sheet_to_json(workbook.Sheets['合併']);
      const inventory2025Data = XLSX.utils.sheet_to_json(workbook.Sheets['2025年6月庫存量']);
      const inventory2024Data = XLSX.utils.sheet_to_json(workbook.Sheets['2024年6月庫存量']);

      const createInventoryMap = (data: any[]) => {
        const map: Record<string, number> = {};
        data.forEach(item => {
          if (item['料號'] && typeof item['期末存量'] === 'number') {
            map[item['料號']] = item['期末存量'];
          }
        });
        return map;
      };

      const inventory2025Map = createInventoryMap(inventory2025Data);
      const inventory2024Map = createInventoryMap(inventory2024Data);
      const data2024 = mergeData.filter((row: any) => row['年月'] === 202406);
      const data2025 = mergeData.filter((row: any) => row['年月'] === 202506);

      setData({
        detailedSummary: calculateDetailedSummary(data2024, data2025),
        warehouseAnalysis2024: calculateWarehouseAnalysis(data2024, inventory2024Map),
        warehouseAnalysis2025: calculateWarehouseAnalysis(data2025, inventory2025Map),
        newItems: calculateNewItems(data2024, data2025, inventory2025Map),
        discontinuedItems: calculateDiscontinuedItems(data2024, data2025, inventory2024Map)
      });
    } catch (err: any) {
      setError('讀取檔案時發生錯誤: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  const calculateDetailedSummary = (data2024: any[], data2025: any[]) => {
    return _(data2024.concat(data2025))
      .groupBy('中類')
      .map((allItems, midCategory) => {
        const items2024 = allItems.filter((item: any) => item['年月'] === 202406);
        const items2025 = allItems.filter((item: any) => item['年月'] === 202506);
        const allSubCategories = new Set([...items2024.map((item: any) => item['小分類']), ...items2025.map((item: any) => item['小分類'])]);
        
        const subCategoryComparisons = Array.from(allSubCategories).map(subCategory => {
          const sub2024Items = items2024.filter((item: any) => item['小分類'] === subCategory);
          const sub2025Items = items2025.filter((item: any) => item['小分類'] === subCategory);
          const rent2024 = _.sumBy(sub2024Items, '費用總額');
          const rent2025 = _.sumBy(sub2025Items, '費用總額');
          const change = rent2025 - rent2024;
          const changeRate = rent2024 > 0 ? (change / rent2024 * 100) : (rent2025 > 0 ? 100 : 0);
          
          return {
            小分類: subCategory,
            倉租2024: Math.round(rent2024),
            倉租2025: Math.round(rent2025),
            變化金額: Math.round(change),
            變化率: changeRate
          };
        }).sort((a, b) => b.變化金額 - a.變化金額);
        
        const totalRent2024 = _.sumBy(items2024, '費用總額');
        const totalRent2025 = _.sumBy(items2025, '費用總額');
        
        return {
          中類: midCategory,
          倉租2024: Math.round(totalRent2024),
          倉租2025: Math.round(totalRent2025),
          變化金額: Math.round(totalRent2025 - totalRent2024),
          變化率: totalRent2024 > 0 ? ((totalRent2025 - totalRent2024) / totalRent2024 * 100) : 0,
          小分類明細: subCategoryComparisons
        };
      })
      .orderBy(['倉租2025'], ['desc'])
      .filter((item: any) => item.中類 !== '原料')
      .slice(0, 10)
      .value();
  };

  const calculateWarehouseAnalysis = (dataYear: any[], inventoryMap: Record<string, number>) => {
    const totalRentAll = _.sumBy(dataYear, '費用總額');
    const totalInventoryAll = _.sumBy(dataYear, (item: any) => inventoryMap[item['料號']] || 0);
    
    return _(dataYear)
      .groupBy('中類')
      .map((items, midCategory) => {
        const warehouseMap: Record<string, number> = {};
        _(items).groupBy('外倉倉別').forEach((warehouseItems, warehouse) => {
          warehouseMap[warehouse] = Math.round(_.sumBy(warehouseItems, '費用總額'));
        });
        
        const subCategoryDetails = _(items)
          .groupBy('小分類')
          .map((subItems, subCategory) => {
            const totalInventory = _.sumBy(subItems, (item: any) => inventoryMap[item['料號']] || 0);
            const rentAmount = Math.round(_.sumBy(subItems, '費用總額'));
            return {
              小分類: subCategory,
              庫存數量: totalInventory,
              倉租金額: rentAmount,
              金額占比: totalRentAll > 0 ? (rentAmount / totalRentAll * 100) : 0,
              庫存占比: totalInventoryAll > 0 ? (totalInventory / totalInventoryAll * 100) : 0
            };
          })
          .orderBy(['倉租金額'], ['desc'])
          .value();
        
        return {
          中類: midCategory,
          總計金額: Math.round(_.sumBy(items, '費用總額')),
          大昌華嘉: warehouseMap['大昌華嘉'] || 0,
          豐安: warehouseMap['豐安'] || 0,
          大榮: warehouseMap['大榮'] || 0,
          川田: warehouseMap['川田'] || 0,
          成功: warehouseMap['成功'] || 0,
          宗運: warehouseMap['宗運'] || 0,
          小分類詳細: subCategoryDetails
        };
      })
      .orderBy(['總計金額'], ['desc'])
      .filter((item: any) => item.中類 !== '原料')
      .slice(0, 10)
      .value();
  };

  const calculateNewItems = (data2024: any[], data2025: any[], inventory2025Map: Record<string, number>) => {
    const existing2024Items = new Set(data2024.map((item: any) => item['料號']));
    const items2025ByCode = new Map();
    data2025.forEach((item: any) => items2025ByCode.set(item['料號'], item));
    
    const newItems2025: any[] = [];
    items2025ByCode.forEach((item, code) => {
      if (!existing2024Items.has(code)) {
        newItems2025.push({
          料號: item['料號'],
          商品名稱: item['商品名稱'],
          庫存數量: inventory2025Map[item['料號']] || 0,
          倉租金額: Math.round(item['費用總額']),
          外倉名稱: item['外倉倉別']
        });
      }
    });
    return newItems2025.sort((a, b) => b.倉租金額 - a.倉租金額);
  };

  const calculateDiscontinuedItems = (data2024: any[], data2025: any[], inventory2024Map: Record<string, number>) => {
    const existing2025Items = new Set(data2025.map((item: any) => item['料號']));
    const items2024ByCode = new Map();
    data2024.forEach((item: any) => items2024ByCode.set(item['料號'], item));
    
    const discontinuedItems2024: any[] = [];
    items2024ByCode.forEach((item, code) => {
      if (!existing2025Items.has(code)) {
        discontinuedItems2024.push({
          料號: item['料號'],
          商品名稱: item['商品名稱'],
          庫存數量: inventory2024Map[item['料號']] || 0,
          倉租金額: Math.round(item['費用總額']),
          外倉名稱: item['外倉倉別']
        });
      }
    });
    return discontinuedItems2024.sort((a, b) => b.倉租金額 - a.倉租金額);
  };

  const formatNumber = (num: number) => new Intl.NumberFormat('zh-TW').format(Math.round(num));
  const formatPercent = (num: number) => `${num >= 0 ? '+' : ''}${num.toFixed(1)}%`;

  const getTrendIcon = (changeRate: number) => {
    const strokeColor = changeRate > 0 ? "#dc2626" : changeRate < 0 ? "#16a34a" : "#6b7280";
    if (changeRate > 0) return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M7 17L17 7" stroke={strokeColor} strokeWidth="2" strokeLinecap="round"/><path d="M10 7H17V14" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    if (changeRate < 0) return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M17 7L7 17" stroke={strokeColor} strokeWidth="2" strokeLinecap="round"/><path d="M14 17H7V10" stroke={strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>;
    return <svg width="20" height="20" viewBox="0 0 24 24" fill="none"><path d="M5 12H19" stroke={strokeColor} strokeWidth="2" strokeLinecap="round"/></svg>;
  };

  const getTrendColor = (changeRate: number) => changeRate > 0 ? 'text-red-600' : changeRate < 0 ? 'text-green-600' : 'text-gray-600';

  const toggleExpand = (category: string, type: string) => {
    const setters: Record<string, any> = { categories: setExpandedCategories, warehouse2024: setExpandedWarehouse2024, warehouse2025: setExpandedWarehouse2025 };
    setters[type]((prev: Record<string, boolean>) => ({ ...prev, [category]: !prev[category] }));
  };

  const renderWarehouseSummary = (data: any[], year: string, bgColor: string) => (
    <div className={`mb-6 ${bgColor} rounded-lg p-6 border border-gray-200`}>
      <h3 className="text-lg font-semibold text-gray-800 mb-4 text-center">{year}年各外倉總計資訊</h3>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {['大昌華嘉', '豐安', '大榮', '川田', '成功', '宗運'].map((warehouse, idx) => {
          const colors = ['text-purple-600', 'text-blue-600', 'text-green-600', 'text-orange-600', 'text-red-600', 'text-indigo-600'];
          return (
            <div key={warehouse} className="text-center bg-white rounded-lg p-3 shadow-sm">
              <div className="text-sm text-gray-600 mb-1">{warehouse}</div>
              <div className={`text-xl font-bold ${colors[idx]}`}>
                {formatNumber(_.sumBy(data, warehouse))}
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 text-center">
        <div className="inline-block bg-gray-800 text-white rounded-lg px-6 py-3">
          <div className="text-sm text-gray-300">總計金額</div>
          <div className="text-2xl font-bold">{formatNumber(_.sumBy(data, '總計金額'))}</div>
        </div>
      </div>
    </div>
  );

  const renderWarehouseTable = (data: any[], year: string, expandedState: any, toggleFunc: any) => (
    <div className="bg-white rounded-lg shadow-lg overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-200">
        <h2 className="text-xl font-semibold text-gray-800">{year}年外倉金額分佈統計</h2>
        <p className="text-sm text-gray-600 mt-1">點擊行可展開小分類詳細資訊</p>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {['中分類', '總計', '大昌華嘉', '豐安', '大榮', '川田', '成功', '宗運', '展開'].map(header => (
                <th key={header} className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${header === '中分類' ? 'text-left' : header === '展開' ? 'text-center' : 'text-right'}`}>
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {data.map((item: any, index: number) => (
              <React.Fragment key={index}>
                <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleFunc(item.中類)}>
                  <td className="px-4 py-4 whitespace-nowrap font-medium text-gray-900">{item.中類}</td>
                  {['總計金額', '大昌華嘉', '豐安', '大榮', '川田', '成功', '宗運'].map(field => (
                    <td key={field} className={`px-4 py-4 whitespace-nowrap text-right ${field === '總計金額' ? 'text-gray-900 font-semibold' : 'text-gray-700'}`}>
                      {formatNumber(item[field])}
                    </td>
                  ))}
                  <td className="px-4 py-4 whitespace-nowrap">
                    <div className="flex justify-center">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${expandedState[item.中類] ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                        <svg className={`w-4 h-4 transform transition-transform duration-200 ${expandedState[item.中類] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </div>
                    </div>
                  </td>
                </tr>
                {expandedState[item.中類] && (
                  <tr>
                    <td colSpan={9} className="px-6 py-4 bg-gray-50">
                      <div className="rounded-lg border border-gray-200 overflow-hidden">
                        <table className="min-w-full">
                          <thead className="bg-gray-100">
                            <tr>
                              {['小分類', '庫存數量', '占總庫存 %', '倉租金額', '占總倉租 %'].map(header => (
                                <th key={header} className={`px-4 py-2 text-xs font-medium text-gray-600 ${header === '小分類' ? 'text-left' : header.includes('%') ? 'text-center' : 'text-right'}`}>
                                  {header}
                                </th>
                              ))}
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100">
                            {item.小分類詳細.map((sub: any, subIndex: number) => (
                              <tr key={subIndex} className="hover:bg-gray-75">
                                <td className="px-4 py-2 text-sm text-gray-900">{sub.小分類}</td>
                                <td className="px-4 py-2 text-sm text-right text-gray-700">{formatNumber(sub.庫存數量)}</td>
                                <td className="px-4 py-2 text-sm text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="w-12 bg-gray-200 rounded-full h-2">
                                      <div className="bg-green-500 h-2 rounded-full" style={{width: `${Math.min(sub.庫存占比, 100)}%`}}></div>
                                    </div>
                                    <span className="text-xs text-gray-600">{sub.庫存占比.toFixed(1)}%</span>
                                  </div>
                                </td>
                                <td className="px-4 py-2 text-sm text-right text-gray-900 font-medium">{formatNumber(sub.倉租金額)}</td>
                                <td className="px-4 py-2 text-sm text-center">
                                  <div className="flex items-center justify-center gap-2">
                                    <div className="w-12 bg-gray-200 rounded-full h-2">
                                      <div className="bg-blue-500 h-2 rounded-full" style={{width: `${Math.min(sub.金額占比, 100)}%`}}></div>
                                    </div>
                                    <span className="text-xs text-gray-600">{sub.金額占比.toFixed(1)}%</span>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </td>
                  </tr>
                )}
              </React.Fragment>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  if (loading) return <div className="flex justify-center items-center min-h-screen"><div className="text-center"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div><p className="text-gray-600">正在載入並分析數據...</p></div></div>;
  if (error) return <div className="flex justify-center items-center min-h-screen"><div className="text-center text-red-600"><h2 className="text-xl font-bold mb-2">載入錯誤</h2><p>{error}</p><button onClick={loadAndProcessData} className="mt-4 px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">重新載入</button></div></div>;
  if (!data) return <div className="text-center p-8">無法載入數據</div>;

  return (
    <div className="max-w-7xl mx-auto p-6 bg-white">
      <h1 className="text-3xl font-bold text-center mb-8 text-gray-800">2025年6月倉租統計資料</h1>
      
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'pie', label: '2025年6月倉租金額占比', icon: '🥧' },
            { id: 'table', label: '產品別倉租統計表', icon: '📊' },
            { id: 'newItems', label: '2025新增品項', icon: '🆕' },
            { id: 'discontinuedItems', label: '2025未入倉品項', icon: '📦' },
            { id: 'warehouse2025', label: '2025外倉金額分佈統計', icon: '🏬' },
            { id: 'warehouse2024', label: '2024外倉金額分佈統計', icon: '🏪' }
          ].map(tab => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} className={`${activeTab === tab.id ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'} whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center gap-2`}>
              <span>{tab.icon}</span>{tab.label}
            </button>
          ))}
        </nav>
      </div>

      {activeTab === 'pie' && (
        <div className="bg-white rounded-lg shadow-lg p-6">
          <h2 className="text-xl font-semibold text-gray-800 mb-6">2025年6月倉租金額占比分析</h2>
          <div className="flex gap-6">
            <div className="flex-1">
              <div className="h-[500px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <defs>
                      {Array.from({length: 10}, (_, i) => (
                        <linearGradient key={i} id={`gradient${i}`} x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor={[
                            '#E3F2FD', '#F3E5F5', '#E8F5E8', '#FFF3E0', '#F1F8E9',
                            '#E0F2F1', '#FFF8E1', '#FCE4EC', '#E8EAF6', '#F9FBE7'
                          ][i]} />
                          <stop offset="100%" stopColor={[
                            '#BBDEFB', '#E1BEE7', '#C8E6C9', '#FFCC80', '#DCEDC8',
                            '#B2DFDB', '#FFF176', '#F8BBD9', '#C5CAE9', '#F0F4C3'
                          ][i]} />
                        </linearGradient>
                      ))}
                    </defs>
                    <Pie
                      data={data.detailedSummary}
                      cx="50%" cy="50%" labelLine={false}
                      label={({中類, percent}: any) => `${中類} ${(percent * 100).toFixed(1)}%`}
                      labelStyle={{ fill: '#000000', fontSize: '14px', fontWeight: '900' }}
                      outerRadius={160} fill="#8884d8" dataKey="倉租2025"
                      onClick={(entry: any) => setSelectedPieCategory(entry)}
                      onMouseEnter={(entry: any) => setSelectedPieCategory(entry)}
                      style={{ cursor: 'pointer' }}
                    >
                      {data.detailedSummary.map((entry: any, index: number) => (
                        <Cell key={`cell-${index}`} fill={selectedPieCategory?.中類 === entry.中類 ? '#90CAF9' : `url(#gradient${index})`} stroke="none" style={{filter: 'drop-shadow(2px 2px 4px rgba(0,0,0,0.1))'}} />
                      ))}
                    </Pie>
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="w-96">
              <div className="bg-gray-50 rounded-lg p-4 h-[500px] overflow-y-auto">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  {selectedPieCategory ? selectedPieCategory.中類 : '點選圓餅圖查看明細'}
                </h3>
                
                {selectedPieCategory ? (
                  <div className="space-y-2">
                    <div className="bg-blue-50 rounded p-2 mb-3">
                      <div className="text-sm text-gray-600">總倉租金額</div>
                      <div className="text-lg font-bold text-blue-600">{formatNumber(selectedPieCategory.倉租2025)}</div>
                    </div>
                    
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-1 text-gray-600 text-base">小分類</th>
                          <th className="text-right py-1 text-gray-600 text-base">金額</th>
                          <th className="text-right py-1 text-gray-600 text-base">占比</th>
                        </tr>
                      </thead>
                      <tbody>
                        {selectedPieCategory.小分類明細 && selectedPieCategory.小分類明細.map((sub: any, index: number) => (
                          <tr key={index} className="border-b border-gray-100">
                            <td className="py-2 text-gray-800 pr-2 truncate text-lg" title={sub.小分類}>{sub.小分類}</td>
                            <td className="py-2 text-right text-gray-700 font-medium text-lg">{formatNumber(sub.倉租2025)}</td>
                            <td className="py-2 text-right text-gray-600 text-lg">
                              {selectedPieCategory.倉租2025 > 0 ? ((sub.倉租2025 / selectedPieCategory.倉租2025) * 100).toFixed(1) : '0.0'}%
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-32 text-gray-500">
                    <div className="text-center">
                      <div className="text-4xl mb-2">👆</div>
                      <p className="text-sm">點選圓餅圖的任一分類</p>
                      <p className="text-xs">查看該分類的小分類明細</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'table' && (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-200">
            <h2 className="text-xl font-semibold text-gray-800">產品別倉租統計表</h2>
            <p className="text-sm text-gray-600 mt-1">點擊行可展開小分類詳細資訊</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {['排名', '中分類', '2025年倉租', '2024年倉租', '變化金額', '變化率', '趨勢', '展開'].map((header, idx) => (
                    <th key={header} className={`px-6 py-3 text-xs font-medium text-gray-500 uppercase tracking-wider ${idx === 0 || idx === 6 || idx === 7 ? 'text-center' : idx === 1 ? 'text-left' : 'text-right'}`}>
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.detailedSummary.map((item: any, index: number) => (
                  <React.Fragment key={index}>
                    <tr className={`${item.變化金額 > 50000 ? 'bg-yellow-50 hover:bg-yellow-100' : 'hover:bg-gray-50'} cursor-pointer`} onClick={() => toggleExpand(item.中類, 'categories')}>
                      <td className="px-6 py-4 whitespace-nowrap text-center text-gray-600 font-medium">{index + 1}</td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900">{item.中類}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-900 font-semibold">{formatNumber(item.倉租2025)}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-gray-700">{formatNumber(item.倉租2024)}</td>
                      <td className={`px-6 py-4 whitespace-nowrap text-right font-medium ${item.變化金額 >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {item.變化金額 >= 0 ? '+' : ''}{formatNumber(item.變化金額)}
                      </td>
                      <td className={`px-6 py-4 whitespace-nowrap text-right font-medium ${getTrendColor(item.變化率)}`}>
                        {formatPercent(item.變化率)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex justify-center">{getTrendIcon(item.變化率)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex justify-center">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-200 ${expandedCategories[item.中類] ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
                            <svg className={`w-4 h-4 transform transition-transform duration-200 ${expandedCategories[item.中類] ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                            </svg>
                          </div>
                        </div>
                      </td>
                    </tr>
                    
                    {expandedCategories[item.中類] && (
                      <tr>
                        <td colSpan={8} className="px-6 py-4 bg-gray-50">
                          <div className="rounded-lg border border-gray-200 overflow-hidden">
                            <table className="min-w-full">
                              <thead className="bg-gray-100">
                                <tr>
                                  {['小分類', '2025年倉租', '2024年倉租', '變化金額', '變化率'].map(header => (
                                    <th key={header} className={`px-4 py-2 text-xs font-medium text-gray-600 ${header === '小分類' ? 'text-left' : 'text-right'}`}>
                                      {header}
                                    </th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-gray-100">
                                {item.小分類明細.map((sub: any, subIndex: number) => (
                                  <tr key={subIndex} className="hover:bg-gray-75">
                                    <td className="px-4 py-2 text-sm text-gray-900">{sub.小分類}</td>
                                    <td className="px-4 py-2 text-sm text-right text-gray-900 font-medium">{formatNumber(sub.倉租2025)}</td>
                                    <td className="px-4 py-2 text-sm text-right text-gray-700">{formatNumber(sub.倉租2024)}</td>
                                    <td className={`px-4 py-2 text-sm text-right ${sub.變化金額 >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                                      {sub.變化金額 >= 0 ? '+' : ''}{formatNumber(sub.變化金額)}
                                    </td>
                                    <td className={`px-4 py-2 text-sm text-right ${getTrendColor(sub.變化率)}`}>
                                      {formatPercent(sub.變化率)}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {['newItems', 'discontinuedItems'].map(type => {
        const isNew = type === 'newItems';
        const items = data[type];
        const title = isNew ? '2025年新增品項清單' : '2025年未入倉品項清單';
        const desc = isNew ? '僅2025年才出現的料號，按倉租金額排序' : '2024年有倉租但2025年未入倉的料號，按2024年倉租金額排序';
        const bgColor = isNew ? 'from-blue-50 to-green-50' : 'from-red-50 to-orange-50';
        const textColor = isNew ? 'text-blue-600' : 'text-red-600';
        const amountColor = isNew ? 'text-green-600' : 'text-orange-600';
        const tagColor = isNew ? 'bg-blue-100 text-blue-800' : 'bg-red-100 text-red-800';
        const icon = isNew ? '🆕' : '📦';
        
        return activeTab === type && (
          <div key={type}>
            <div className={`mb-6 bg-gradient-to-r ${bgColor} rounded-lg p-4`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-8">
                  <div className="text-center">
                    <span className="text-sm text-gray-600">{isNew ? '新增' : '未入倉'}品項數量</span>
                    <div className={`text-2xl font-bold ${textColor}`}>{items.length} 項</div>
                  </div>
                  <div className="text-center">
                    <span className="text-sm text-gray-600">{isNew ? '倉租總金額' : '2024年倉租金額'}</span>
                    <div className={`text-2xl font-bold ${amountColor}`}>{formatNumber(_.sumBy(items, '倉租金額'))} 元</div>
                  </div>
                </div>
                <div className="text-4xl">{icon}</div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow-lg overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h2 className="text-xl font-semibold text-gray-800">{title}</h2>
                <p className="text-sm text-gray-600 mt-1">{desc}</p>
              </div>
              
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">料號</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">商品名稱</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{isNew ? '庫存數量' : '2024庫存數量'}</th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{isNew ? '倉租金額' : '2024倉租金額'}</th>
                      <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">{isNew ? '外倉名稱' : '2024外倉名稱'}</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {items.map((item: any, index: number) => (
                      <tr key={index} className="hover:bg-gray-50">
                        <td className="px-6 py-4 whitespace-nowrap font-mono text-sm text-gray-900">{item.料號}</td>
                        <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate" title={item.商品名稱}>{item.商品名稱}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-700">{formatNumber(item.庫存數量)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm text-gray-900 font-semibold">{formatNumber(item.倉租金額)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-center text-sm">
                          <span className={`px-2 py-1 text-xs rounded-full ${tagColor}`}>{item.外倉名稱}</span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}

      {activeTab === 'warehouse2025' && (
        <>
          {renderWarehouseSummary(data.warehouseAnalysis2025, '2025', 'bg-gradient-to-r from-blue-50 to-indigo-50')}
          {renderWarehouseTable(data.warehouseAnalysis2025, '2025', expandedWarehouse2025, (category: string) => toggleExpand(category, 'warehouse2025'))}
        </>
      )}

      {activeTab === 'warehouse2024' && (
        <>
          {renderWarehouseSummary(data.warehouseAnalysis2024, '2024', 'bg-gradient-to-r from-gray-50 to-slate-50')}
          {renderWarehouseTable(data.warehouseAnalysis2024, '2024', expandedWarehouse2024, (category: string) => toggleExpand(category, 'warehouse2024'))}
        </>
      )}
    </div>
  );
};

export default WarehouseAnalysisSystem;
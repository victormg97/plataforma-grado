'use client';

import { useState, useRef, useCallback } from 'react';
import { useTranslations } from 'next-intl';
import { format, parseISO, startOfMonth, endOfMonth, eachMonthOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';
import { Download, BarChart2, TrendingUp, PieChart } from 'lucide-react';
import {
  BarChart, Bar, LineChart, Line, PieChart as RechartsPieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
} from 'recharts';
import { AppSelect } from '@/components/common/AppSelect';
import { Tooltip } from '@/components/common/Tooltip';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Clase = Record<string, any>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Prueba = Record<string, any>;

interface TabEstadisticasProps {
  data: {
    historial_clases: Clase[];
    pruebas: Prueba[];
  };
}

type Categoria = 'todas' | 'confirmadas' | 'canceladas' | 'pendientes' | 'prueba' | 'notas';
type TipoGrafico = 'bar' | 'line' | 'pie';

const GOLD = '#C9993F';
const GOLD_LIGHT = '#E8C97A';
const SUCCESS = '#2D6A4F';
const ERROR = '#C0392B';
const INFO = '#2C5F8A';
const CHART_COLORS = [GOLD, SUCCESS, ERROR, INFO, GOLD_LIGHT, '#8b5cf6', '#ec4899'];

export function TabEstadisticas({ data }: TabEstadisticasProps) {
  const t = useTranslations('ficha');
  const chartRef = useRef<HTMLDivElement>(null);

  const [categoria, setCategoria] = useState<Categoria>('todas');
  const [tipoGrafico, setTipoGrafico] = useState<TipoGrafico>('bar');

  // Date range
  const allFechas = data.historial_clases.map((c) => c.fecha).filter(Boolean).sort();
  const minFecha = allFechas[0] ?? new Date().toISOString().slice(0, 10);
  const maxFecha = allFechas[allFechas.length - 1] ?? new Date().toISOString().slice(0, 10);
  const [fechaInicio, setFechaInicio] = useState(minFecha);
  const [fechaFin, setFechaFin] = useState(maxFecha);

  // Filter clases by range
  const clasesFiltradas = data.historial_clases.filter((c) => {
    const f = c.fecha;
    return f >= fechaInicio && f <= fechaFin;
  });

  // Whether notas category is available
  const hasNotas = data.pruebas.some((p) => p.nota !== null);

  // Build monthly chart data
  const chartData = useCallback(() => {
    if (!clasesFiltradas.length) return [];

    const meses = eachMonthOfInterval({
      start: parseISO(fechaInicio + 'T00:00:00'),
      end: parseISO(fechaFin + 'T00:00:00'),
    });

    return meses.map((mes) => {
      const label = format(mes, 'MMM yy', { locale: es });
      const inicio = format(startOfMonth(mes), 'yyyy-MM-dd');
      const fin = format(endOfMonth(mes), 'yyyy-MM-dd');
      const enMes = clasesFiltradas.filter((c) => c.fecha >= inicio && c.fecha <= fin);
      const confirmadas = enMes.filter((c) => c.asistencia?.[0]?.estado === 'confirmado').length;
      const canceladas = enMes.filter((c) => c.asistencia?.[0]?.estado === 'cancelado').length;
      const pendientes = enMes.filter((c) => !c.asistencia?.[0] || c.asistencia[0].estado === 'pendiente').length;
      const prueba = enMes.filter((c) => c.from_programa).length;
      // Average nota for pruebas in this month
      const pruebasMes = data.pruebas.filter((p) => p.fecha >= inicio && p.fecha <= fin && p.nota !== null);
      const nota_promedio = pruebasMes.length
        ? Math.round((pruebasMes.reduce((sum, p) => sum + Number(p.nota), 0) / pruebasMes.length) * 10) / 10
        : null;
      return {
        mes: label,
        total: enMes.length,
        confirmadas,
        canceladas,
        pendientes,
        prueba,
        nota_promedio,
      };
    });
  }, [clasesFiltradas, fechaInicio, fechaFin, data.pruebas])();

  // Pie data (overall)
  const pieData = (() => {
    const confirmadas = clasesFiltradas.filter((c) => c.asistencia?.[0]?.estado === 'confirmado').length;
    const canceladas = clasesFiltradas.filter((c) => c.asistencia?.[0]?.estado === 'cancelado').length;
    const pendientes = clasesFiltradas.filter((c) => !c.asistencia?.[0] || c.asistencia[0].estado === 'pendiente').length;
    return [
      { name: t('stat_confirmadas'), value: confirmadas, color: SUCCESS },
      { name: t('stat_canceladas'), value: canceladas, color: ERROR },
      { name: t('cat_pendientes'), value: pendientes, color: GOLD },
    ].filter((d) => d.value > 0);
  })();

  const categoriaOptions = [
    { value: 'todas', label: t('cat_todas') },
    { value: 'confirmadas', label: t('cat_confirmadas') },
    { value: 'canceladas', label: t('cat_canceladas') },
    { value: 'pendientes', label: t('cat_pendientes') },
    { value: 'prueba', label: t('cat_prueba') },
    ...(hasNotas ? [{ value: 'notas', label: t('cat_notas') }] : []),
  ];

  const downloadPNG = () => {
    if (!chartRef.current) return;
    import('html2canvas').then(({ default: html2canvas }) => {
      html2canvas(chartRef.current!).then((canvas) => {
        const link = document.createElement('a');
        link.download = `estadisticas-alumno.png`;
        link.href = canvas.toDataURL();
        link.click();
      });
    }).catch(() => {
      // Fallback: try SVG export
      const svg = chartRef.current!.querySelector('svg');
      if (!svg) return;
      const blob = new Blob([svg.outerHTML], { type: 'image/svg+xml' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'estadisticas-alumno.svg';
      link.click();
    });
  };

  const downloadCSV = () => {
    const rows = [
      ['Mes', 'Total', 'Confirmadas', 'Canceladas', 'Pendientes', 'Prueba'],
      ...chartData.map((d) => [d.mes, d.total, d.confirmadas, d.canceladas, d.pendientes, d.prueba]),
    ];
    const csv = rows.map((r) => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'estadisticas-alumno.csv';
    link.click();
  };

  // Get bars/lines to show based on categoria
  const getKeys = () => {
    switch (categoria) {
      case 'confirmadas': return [{ key: 'confirmadas', color: SUCCESS, label: t('cat_confirmadas') }];
      case 'canceladas': return [{ key: 'canceladas', color: ERROR, label: t('cat_canceladas') }];
      case 'pendientes': return [{ key: 'pendientes', color: GOLD, label: t('cat_pendientes') }];
      case 'prueba': return [{ key: 'prueba', color: INFO, label: t('cat_prueba') }];
      case 'notas': return [{ key: 'nota_promedio', color: GOLD, label: t('cat_notas') }];
      default:
        return [
          { key: 'total', color: GOLD_LIGHT, label: t('stat_total') },
          { key: 'confirmadas', color: SUCCESS, label: t('cat_confirmadas') },
          { key: 'canceladas', color: ERROR, label: t('cat_canceladas') },
          { key: 'pendientes', color: GOLD, label: t('cat_pendientes') },
          { key: 'prueba', color: INFO, label: t('cat_prueba') },
        ];
    }
  };
  const keys = getKeys();

  const tooltipStyle = {
    backgroundColor: 'var(--color-bg)',
    border: '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    color: 'var(--color-text-primary)',
    fontSize: '12px',
  };

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex flex-wrap gap-3">
        {/* Categoria */}
        <div className="min-w-[160px] flex-1">
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
            {t('categoria')}
          </label>
          <AppSelect
            value={categoria}
            onChange={(v) => setCategoria(v as Categoria)}
            options={categoriaOptions}
            className="w-full"
          />
        </div>

        {/* Fecha inicio */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
            {t('fecha_desde')}
          </label>
          <input
            type="date"
            value={fechaInicio}
            min={minFecha}
            max={fechaFin}
            onChange={(e) => setFechaInicio(e.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]"
          />
        </div>

        {/* Fecha fin */}
        <div>
          <label className="mb-1 block text-xs font-medium text-[var(--color-text-muted)]">
            {t('fecha_hasta')}
          </label>
          <input
            type="date"
            value={fechaFin}
            min={fechaInicio}
            max={maxFecha}
            onChange={(e) => setFechaFin(e.target.value)}
            className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm focus:border-[var(--color-brand-gold)] focus:outline-none focus:ring-1 focus:ring-[var(--color-brand-gold)]"
          />
        </div>
      </div>

      {/* Chart type selector */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-[var(--color-text-muted)]">{t('tipo_grafico')}:</span>
        {([
          { key: 'bar' as const, icon: <BarChart2 className="size-4" />, label: t('grafico_barras') },
          { key: 'line' as const, icon: <TrendingUp className="size-4" />, label: t('grafico_lineas') },
          { key: 'pie' as const, icon: <PieChart className="size-4" />, label: t('grafico_pie') },
        ] as const).map(({ key, icon, label }) => (
          <Tooltip key={key} content={label} position="top">
            <button
              onClick={() => setTipoGrafico(key)}
              className={`rounded-[var(--radius-sm)] p-2 transition-colors ${
                tipoGrafico === key
                  ? 'bg-[var(--color-brand-gold)] text-white shadow-sm'
                  : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)]'
              }`}
            >
              {icon}
            </button>
          </Tooltip>
        ))}

        <div className="ml-auto flex gap-2">
          <Tooltip content={t('descargar_png')} position="top">
            <button
              onClick={downloadPNG}
              className="rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] transition-colors"
            >
              <Download className="size-4" />
            </button>
          </Tooltip>
          <Tooltip content={t('descargar_csv')} position="top">
            <button
              onClick={downloadCSV}
              className="rounded-[var(--radius-sm)] bg-[var(--color-bg-secondary)] p-2 text-[var(--color-text-muted)] hover:bg-[var(--color-bg-elevated)] transition-colors text-xs font-semibold"
            >
              CSV
            </button>
          </Tooltip>
        </div>
      </div>

      {/* Chart */}
      <div
        ref={chartRef}
        className="rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-bg)] p-4"
      >
        {chartData.length === 0 ? (
          <div className="flex h-48 items-center justify-center">
            <p className="text-sm text-[var(--color-text-muted)]">{t('sin_datos_rango')}</p>
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={280}>
            {tipoGrafico === 'bar' ? (
              <BarChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} allowDecimals={false} />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {keys.map(({ key, color, label }) => (
                  <Bar key={key} dataKey={key} name={label} fill={color} radius={[4, 4, 0, 0]} />
                ))}
              </BarChart>
            ) : tipoGrafico === 'line' ? (
              <LineChart data={chartData} margin={{ top: 5, right: 10, left: -20, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                <XAxis dataKey="mes" tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} allowDecimals={false} />
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                {keys.map(({ key, color, label }) => (
                  <Line
                    key={key}
                    type="monotone"
                    dataKey={key}
                    name={label}
                    stroke={color}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: color }}
                    activeDot={{ r: 6 }}
                  />
                ))}
              </LineChart>
            ) : (
              <RechartsPieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  outerRadius={100}
                  innerRadius={50}
                  dataKey="value"
                  label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}
                  labelLine={false}
                >
                  {pieData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color ?? CHART_COLORS[index % CHART_COLORS.length]} />
                  ))}
                </Pie>
                <RechartsTooltip contentStyle={tooltipStyle} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </RechartsPieChart>
            )}
          </ResponsiveContainer>
        )}
      </div>

      {/* Summary table */}
      <div className="rounded-[var(--radius-md)] border border-[var(--color-border)] overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[var(--color-border)] bg-[var(--color-bg-secondary)] text-left text-xs font-semibold uppercase text-[var(--color-text-muted)]">
              <th className="px-4 py-2">{t('tabla_mes')}</th>
              <th className="px-4 py-2 text-center">{t('stat_total')}</th>
              <th className="px-4 py-2 text-center">{t('cat_confirmadas')}</th>
              <th className="px-4 py-2 text-center">{t('cat_canceladas')}</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((row, i) => (
              <tr
                key={i}
                className="border-b border-[var(--color-border)] last:border-0 hover:bg-[var(--color-bg-secondary)] transition-colors"
              >
                <td className="px-4 py-2 font-medium">{row.mes}</td>
                <td className="px-4 py-2 text-center">{row.total}</td>
                <td className="px-4 py-2 text-center text-[var(--color-success)]">{row.confirmadas}</td>
                <td className="px-4 py-2 text-center text-[var(--color-error)]">{row.canceladas}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

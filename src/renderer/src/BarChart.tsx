import { onMount, onCleanup } from 'solid-js'
import * as echarts from 'echarts'

const BarChart = () => {
  let chartDiv: HTMLElement | null | undefined

  onMount(() => {
    // Initialize the chart
    const myChart = echarts.init(chartDiv, 'dark')

    // Specify the chart options
    const options = {
      title: {
        text: 'Deep Work Hours'
      },
      animationDuration: 3000,
      tooltip: {},
      xAxis: {
        type: 'category',
        data: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday']
      },
      yAxis: {
        type: 'value'
      },
      series: [
        {
          name: 'Hours',
          type: 'bar',
          data: [5, 6, 7, 8, 4, 3, 6] // Example data
        }
      ]
    }

    // Set the options to the chart
    myChart.setOption(options)

    // Add resize listener to make the chart responsive
    window.addEventListener('resize', () => {
      myChart.resize()
    })

    // Clean up the chart on unmount
    onCleanup(() => {
      myChart.dispose()
    })
  })

  return <div ref={chartDiv} style={{ width: '100%', height: '400px' }}></div>
}

export default BarChart

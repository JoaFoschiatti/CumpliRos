import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TrafficLightCard } from './traffic-light-card';

describe('TrafficLightCard', () => {
  it('should render title and value', () => {
    render(<TrafficLightCard title="Test Title" value={42} color="green" />);

    expect(screen.getByText('Test Title')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
  });

  it('should render description when provided', () => {
    render(
      <TrafficLightCard
        title="Test Title"
        value={10}
        color="green"
        description="Test description"
      />
    );

    expect(screen.getByText('Test description')).toBeInTheDocument();
  });

  it('should not render description when not provided', () => {
    render(<TrafficLightCard title="Test Title" value={10} color="green" />);

    expect(screen.queryByText('Test description')).not.toBeInTheDocument();
  });

  it('should apply green color class', () => {
    const { container } = render(
      <TrafficLightCard title="Green Card" value={5} color="green" />
    );

    const colorIndicator = container.querySelector('.bg-green-500');
    expect(colorIndicator).toBeInTheDocument();
  });

  it('should apply yellow color class', () => {
    const { container } = render(
      <TrafficLightCard title="Yellow Card" value={5} color="yellow" />
    );

    const colorIndicator = container.querySelector('.bg-yellow-500');
    expect(colorIndicator).toBeInTheDocument();
  });

  it('should apply red color class', () => {
    const { container } = render(
      <TrafficLightCard title="Red Card" value={5} color="red" />
    );

    const colorIndicator = container.querySelector('.bg-red-500');
    expect(colorIndicator).toBeInTheDocument();
  });

  it('should apply gray color class', () => {
    const { container } = render(
      <TrafficLightCard title="Gray Card" value={5} color="gray" />
    );

    const colorIndicator = container.querySelector('.bg-gray-500');
    expect(colorIndicator).toBeInTheDocument();
  });

  it('should render value as 0', () => {
    render(<TrafficLightCard title="Zero Value" value={0} color="green" />);

    expect(screen.getByText('0')).toBeInTheDocument();
  });

  it('should render large values', () => {
    render(<TrafficLightCard title="Large Value" value={99999} color="green" />);

    expect(screen.getByText('99999')).toBeInTheDocument();
  });
});

"use client";
import CarRentalCard from './CarRentalCard';
// import styles from './CarRentalList.module.css';

const CarRentalList = ({ cars }) => {
  return (
    <div className={styles.carRentalList}>
      {cars.map((car) => (
        <CarRentalCard key={car.id} car={car} />
      ))}
    </div>
  );
};

export default CarRentalList;
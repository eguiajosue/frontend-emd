import React from 'react'

interface TitleProps {
  title: string;
}

const Title = ({ title }: TitleProps) => {
  return (
    <h1 className='text-4xl font-bold pb-4'>{title}</h1>
  )
}

export default Title

import React from 'react'

interface TitleProps {
  title: string;
}

const Title = ({ title }: TitleProps) => {
  return (
    <h1 className='text-4xl font-bold leading-tight tracking-tight pb-4'>{title}</h1>
  )
}

export default Title
